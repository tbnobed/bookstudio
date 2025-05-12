// Bookings and form types

export type BookingSeverity = 'low' | 'medium' | 'high';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';
export type BookingType = 'production' | 'maintenance' | 'other';

export interface ApiBooking {
  id: number;
  title: string;
  description: string;
  studioId?: number;
  studio_id?: number;
  pcrRoomId?: number;
  pcr_room_id?: number;
  userId?: number;
  user_id?: number;
  start: string;
  end: string;
  type: BookingType;
  templateId?: number;
  template_id?: number;
  notifyList?: number[];
  notify_list?: number[];
  createdAt?: string;
  created_at?: string;
  severity: BookingSeverity;
  status: BookingStatus;
  color: string;
}

export interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number;
  type: BookingType;
  start: string;
  end: string;
  templateId: number;
  notifyList: number[];
  severity: BookingSeverity;
  status: BookingStatus;
  color: string;
}

export interface Studio {
  id: number;
  name: string;
  description: string;
  status: string;
}

export interface PcrRoom {
  id: number;
  name: string;
  description: string;
  status: string;
}

export interface Template {
  id: number;
  name: string;
  description: string;
  duration: number;
  studioId?: number;
  pcrRoomId?: number;
  type: BookingType;
  notifyList?: number[];
}

export interface NotificationGroup {
  id: number;
  name: string;
  description: string;
  userIds?: number[];
}

export interface BookingStudioLink {
  id: number;
  bookingId: number;
  studioId: number;
}