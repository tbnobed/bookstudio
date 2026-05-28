import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertCrewPositionSchema, insertCrewMemberSchema, insertCrewTemplateSchema,
} from "@shared/schema";
import { sendCrewInviteEmail, sendCrewResponseNotification } from "./crew-email";
import { AuditService, getAuditContext } from "./services/auditService";

type Middleware = (req: Request, res: Response, next: Function) => any;

// Auto rate selection: ≤5h = half-day, >5h = day
export function computeRate(start: Date, end: Date, dayCents: number, halfDayCents: number) {
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  const rateType: "day" | "half-day" = hours <= 5 ? "half-day" : "day";
  const rateCents = rateType === "half-day" ? (halfDayCents || dayCents) : dayCents;
  return { rateType, rateCents, hours };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function registerCrewRoutes(app: Express, mw: { isAuthenticated: Middleware; hasRole: (roles: string[]) => Middleware }) {
  const { isAuthenticated, hasRole } = mw;
  const ADMIN_ROLES = ["admin", "site_manager"];
  // Producers/production can manage their roster too
  const PRODUCER_ROLES = ["admin", "site_manager", "producer", "production"];

  // ─── Public response routes (no auth) ──────────────────────────────────────
  app.get("/api/crew/respond/:token", async (req, res) => {
    try {
      const slot = await storage.getBookingCrewByToken(req.params.token);
      if (!slot) return res.status(404).json({ message: "Invalid or expired link" });
      const [booking, position, member] = await Promise.all([
        storage.getBooking(slot.bookingId),
        storage.getCrewPosition(slot.positionId),
        slot.crewMemberId ? storage.getCrewMember(slot.crewMemberId) : Promise.resolve(undefined),
      ]);
      const studios = booking ? await storage.getBookingStudios(booking.id) : [];
      // Strip token & internal-only fields from the public payload.
      const { responseToken: _t, createdBy: _c, ...safeSlot } = slot as any;
      const safeMember = member ? { name: member.name } : null;
      res.json({ slot: safeSlot, booking, position, member: safeMember, studios });
    } catch (err: any) {
      console.error("crew respond GET error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/crew/respond/:token", async (req, res) => {
    try {
      const { action, reason } = z.object({
        action: z.enum(["accept", "decline"]),
        reason: z.string().optional(),
      }).parse(req.body);

      const slot = await storage.getBookingCrewByToken(req.params.token);
      if (!slot) return res.status(404).json({ message: "Invalid or expired link" });
      if (slot.status === "confirmed" || slot.status === "declined") {
        return res.status(409).json({ message: `Already ${slot.status}`, currentStatus: slot.status });
      }

      const newStatus = action === "accept" ? "confirmed" : "declined";
      const updated = await storage.updateBookingCrewSlot(slot.id, {
        status: newStatus,
        respondedAt: new Date(),
        declineReason: action === "decline" ? (reason || null) as any : null as any,
      });

      // Notify producer
      try {
        const [booking, position, member, producer] = await Promise.all([
          storage.getBooking(slot.bookingId),
          storage.getCrewPosition(slot.positionId),
          slot.crewMemberId ? storage.getCrewMember(slot.crewMemberId) : Promise.resolve(undefined),
          storage.getUser(slot.createdBy),
        ]);
        if (producer && booking && position && member) {
          await sendCrewResponseNotification({
            to: producer.email,
            producerName: producer.name,
            crewName: member.name,
            positionName: position.name,
            bookingTitle: booking.title,
            bookingId: booking.id,
            status: newStatus,
            declineReason: action === "decline" ? reason : undefined,
          });
        }
      } catch (e) { console.error("Notify producer failed:", e); }

      res.json({ slot: updated, status: newStatus });
    } catch (err: any) {
      console.error("crew respond POST error:", err);
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Crew positions ────────────────────────────────────────────────────────
  app.get("/api/crew/positions", isAuthenticated, async (_req, res) => {
    res.json(await storage.getAllCrewPositions());
  });

  app.post("/api/crew/positions", isAuthenticated, hasRole(ADMIN_ROLES), async (req, res) => {
    try {
      const data = insertCrewPositionSchema.parse(req.body);
      const created = await storage.createCrewPosition(data);
      await AuditService.log(getAuditContext(req), "create", "crew_position", created.id, created.name);
      res.status(201).json(created);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/crew/positions/:id", isAuthenticated, hasRole(ADMIN_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertCrewPositionSchema.partial().parse(req.body);
      const updated = await storage.updateCrewPosition(id, data);
      if (!updated) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "update", "crew_position", id, updated.name);
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/crew/positions/:id", isAuthenticated, hasRole(ADMIN_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pos = await storage.getCrewPosition(id);
      const ok = await storage.deleteCrewPosition(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "delete", "crew_position", id, pos?.name || "?");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ─── Crew members ──────────────────────────────────────────────────────────
  app.get("/api/crew/members", isAuthenticated, async (_req, res) => {
    const members = await storage.getAllCrewMembers();
    // Enrich with position list
    const enriched = await Promise.all(members.map(async (m) => ({
      ...m,
      positions: await storage.getCrewMemberPositions(m.id),
    })));
    res.json(enriched);
  });

  app.get("/api/crew/members/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const member = await storage.getCrewMember(id);
    if (!member) return res.status(404).json({ message: "Not found" });
    const positions = await storage.getCrewMemberPositions(id);
    res.json({ ...member, positions });
  });

  app.get("/api/crew/members/:id/upcoming", isAuthenticated, async (req, res) => {
    res.json(await storage.getCrewMemberUpcomingBookings(parseInt(req.params.id)));
  });

  app.post("/api/crew/members", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const user = req.user as any;
      const positionIds = Array.isArray(req.body.positionIds) ? req.body.positionIds.map((n: any) => parseInt(n)) : [];
      const data = insertCrewMemberSchema.parse({ ...req.body, createdBy: user.id });
      const existing = await storage.getCrewMemberByEmail(data.email);
      if (existing) return res.status(409).json({ message: "A crew member with that email already exists" });
      const created = await storage.createCrewMember(data, positionIds);
      await AuditService.log(getAuditContext(req), "create", "crew_member", created.id, created.name);
      res.status(201).json(created);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/crew/members/:id", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const positionIds = Array.isArray(req.body.positionIds) ? req.body.positionIds.map((n: any) => parseInt(n)) : undefined;
      const { positionIds: _omit, ...rest } = req.body;
      const data = insertCrewMemberSchema.partial().parse(rest);
      const updated = await storage.updateCrewMember(id, data, positionIds);
      if (!updated) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "update", "crew_member", id, updated.name);
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/crew/members/:id", isAuthenticated, hasRole(ADMIN_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const member = await storage.getCrewMember(id);
      const ok = await storage.deleteCrewMember(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "delete", "crew_member", id, member?.name || "?");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ─── Crew templates ────────────────────────────────────────────────────────
  app.get("/api/crew/templates", isAuthenticated, async (_req, res) => {
    const templates = await storage.getAllCrewTemplates();
    const enriched = await Promise.all(templates.map(async (t) => ({
      ...t, slots: await storage.getCrewTemplateSlots(t.id),
    })));
    res.json(enriched);
  });

  app.get("/api/crew/templates/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const tpl = await storage.getCrewTemplate(id);
    if (!tpl) return res.status(404).json({ message: "Not found" });
    const slots = await storage.getCrewTemplateSlots(id);
    res.json({ ...tpl, slots });
  });

  const slotSchema = z.object({ positionId: z.number().int(), quantity: z.number().int().min(1).max(50) });

  app.post("/api/crew/templates", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const user = req.user as any;
      const slots = z.array(slotSchema).default([]).parse(req.body.slots || []);
      const { slots: _omit, ...rest } = req.body;
      const data = insertCrewTemplateSchema.parse({ ...rest, createdBy: user.id });
      const created = await storage.createCrewTemplate(data, slots);
      await AuditService.log(getAuditContext(req), "create", "crew_template", created.id, created.name);
      res.status(201).json(created);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.patch("/api/crew/templates/:id", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const slots = req.body.slots ? z.array(slotSchema).parse(req.body.slots) : undefined;
      const { slots: _omit, ...rest } = req.body;
      const data = insertCrewTemplateSchema.partial().parse(rest);
      const updated = await storage.updateCrewTemplate(id, data, slots);
      if (!updated) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "update", "crew_template", id, updated.name);
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete("/api/crew/templates/:id", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tpl = await storage.getCrewTemplate(id);
      const ok = await storage.deleteCrewTemplate(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      await AuditService.log(getAuditContext(req), "delete", "crew_template", id, tpl?.name || "?");
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ─── Booking crew assignments ──────────────────────────────────────────────
  app.get("/api/bookings/:id/crew", isAuthenticated, async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const slots = await storage.getBookingCrew(bookingId);
    const booking = await storage.getBooking(bookingId);
    const { rateType: defaultRateType, hours } = booking
      ? computeRate(new Date(booking.start), new Date(booking.end), 0, 0)
      : { rateType: "day" as const, hours: 0 };

    const enriched = await Promise.all(slots.map(async (s) => {
      const position = await storage.getCrewPosition(s.positionId);
      const member = s.crewMemberId ? await storage.getCrewMember(s.crewMemberId) : null;
      return { ...s, position, member };
    }));

    const totalCents = enriched.reduce((sum, s) =>
      s.status !== "declined" && s.crewMemberId ? sum + (s.rateSnapshotCents || 0) : sum, 0);

    res.json({ slots: enriched, totals: { cents: totalCents, defaultRateType, hours } });
  });

  app.post("/api/bookings/:id/crew", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const user = req.user as any;
      const bookingId = parseInt(req.params.id);
      const { positionId } = z.object({ positionId: z.number().int() }).parse(req.body);
      const slot = await storage.addBookingCrewSlot({
        bookingId, positionId, status: "unfilled", createdBy: user.id,
      } as any);
      res.status(201).json(slot);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.post("/api/bookings/:id/crew/apply-template", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const user = req.user as any;
      const bookingId = parseInt(req.params.id);
      const { templateId } = z.object({ templateId: z.number().int() }).parse(req.body);
      const created = await storage.applyCrewTemplateToBooking(bookingId, templateId, user.id);
      res.json({ created: created.length, slots: created });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Assign a crew member to a slot (computes rate, checks conflicts)
  app.patch("/api/bookings/:bookingId/crew/:slotId", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const slotId = parseInt(req.params.slotId);
      const { crewMemberId, notes } = z.object({
        crewMemberId: z.number().int().nullable().optional(),
        notes: z.string().nullable().optional(),
      }).parse(req.body);

      const slot = await storage.updateBookingCrewSlot(slotId, {}); // existence check via subsequent fetch
      const allSlots = await storage.getBookingCrew(bookingId);
      const target = allSlots.find(s => s.id === slotId);
      if (!target) return res.status(404).json({ message: "Slot not found" });

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const update: any = { notes: notes ?? target.notes };
      // On ANY change to crewMemberId, invalidate prior invite tokens/state so a
      // previous recipient cannot accept/decline a slot now assigned to someone else.
      const reassigning = crewMemberId !== undefined && crewMemberId !== target.crewMemberId;
      if (crewMemberId === null) {
        update.crewMemberId = null;
        update.status = "unfilled";
        update.rateType = null;
        update.rateSnapshotCents = 0;
        update.responseToken = null;
        update.invitedAt = null;
        update.respondedAt = null;
        update.declineReason = null;
      } else if (typeof crewMemberId === "number") {
        const member = await storage.getCrewMember(crewMemberId);
        if (!member) return res.status(404).json({ message: "Crew member not found" });
        // Conflict check — includes unfilled assigned slots so producers can't
        // double-book the same person across overlapping productions.
        const conflicts = await storage.getCrewConflicts(crewMemberId, new Date(booking.start), new Date(booking.end), slotId);
        if (conflicts.length > 0) {
          return res.status(409).json({
            message: `${member.name} is already booked during this time.`,
            conflicts,
          });
        }
        const { rateType, rateCents } = computeRate(new Date(booking.start), new Date(booking.end), member.dayRateCents, member.halfDayRateCents);
        update.crewMemberId = crewMemberId;
        update.rateType = rateType;
        update.rateSnapshotCents = rateCents;
        if (reassigning) {
          // Reset invite state on reassignment — old token MUST NOT be reusable.
          update.status = "unfilled";
          update.responseToken = null;
          update.invitedAt = null;
          update.respondedAt = null;
          update.declineReason = null;
        }
      }

      const updated = await storage.updateBookingCrewSlot(slotId, update);
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Send invite email for a slot — must have a crewMember assigned
  app.post("/api/bookings/:bookingId/crew/:slotId/invite", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const slotId = parseInt(req.params.slotId);

      const allSlots = await storage.getBookingCrew(bookingId);
      const slot = allSlots.find(s => s.id === slotId);
      if (!slot || !slot.crewMemberId) return res.status(400).json({ message: "Assign a crew member before sending the invite." });

      const [booking, position, member, producer] = await Promise.all([
        storage.getBooking(bookingId),
        storage.getCrewPosition(slot.positionId),
        storage.getCrewMember(slot.crewMemberId),
        storage.getUser((req.user as any).id),
      ]);
      if (!booking || !position || !member || !producer) return res.status(404).json({ message: "Missing data" });

      // Always issue a fresh token on (re-)invite. Any prior link is invalidated.
      const token = generateToken();
      const studios = await storage.getBookingStudios(bookingId);

      // Refresh status + token
      const updated = await storage.updateBookingCrewSlot(slotId, {
        status: "pending",
        responseToken: token,
        invitedAt: new Date(),
        respondedAt: null as any,
        declineReason: null as any,
      });

      const ok = await sendCrewInviteEmail({
        to: member.email,
        crewName: member.name,
        positionName: position.name,
        booking,
        rateType: (slot.rateType as "day" | "half-day") || "day",
        rateCents: slot.rateSnapshotCents || 0,
        token,
        producerName: producer.name,
        studioNames: studios.map(s => s.name),
      });

      await AuditService.log(getAuditContext(req), "invite_sent", "booking_crew", slotId, `${position.name} → ${member.name}`);
      res.json({ success: ok, slot: updated });
    } catch (err: any) {
      console.error("Send invite error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bookings/:bookingId/crew/:slotId", isAuthenticated, hasRole(PRODUCER_ROLES), async (req, res) => {
    try {
      const ok = await storage.deleteBookingCrewSlot(parseInt(req.params.slotId));
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
}
