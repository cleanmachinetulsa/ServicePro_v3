import { describe, it, expect } from 'vitest';
import { deriveBookingStatus } from '@shared/bookingStatus';

describe('Booking Status No Lies Rule', () => {
  describe('CONFIRMED status requires both appointmentId AND calendarEventId', () => {
    it('should return CONFIRMED only when both bookingId and calendarEventId exist', () => {
      const record = {
        bookingId: 123,
        calendarEventId: 'cal_abc123',
        needsHuman: false,
        stage: 'booked',
        status: 'active',
      };

      expect(deriveBookingStatus(record)).toBe('CONFIRMED');
    });

    it('should NOT return CONFIRMED when only bookingId exists (no calendarEventId)', () => {
      const record = {
        bookingId: 123,
        calendarEventId: null,
        needsHuman: false,
        stage: 'booked',
        status: 'active',
      };

      const status = deriveBookingStatus(record);
      expect(status).not.toBe('CONFIRMED');
      expect(status).toBe('AWAITING_CONFIRM');
    });

    it('should NOT return CONFIRMED when only calendarEventId exists (no bookingId)', () => {
      const record = {
        bookingId: null,
        calendarEventId: 'cal_abc123',
        needsHuman: false,
        stage: 'booked',
        status: 'active',
      };

      const status = deriveBookingStatus(record);
      expect(status).not.toBe('CONFIRMED');
      expect(status).toBe('AWAITING_CONFIRM');
    });

    it('should NOT return CONFIRMED when both are null', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        stage: 'choosing_slot',
        status: 'active',
      };

      const status = deriveBookingStatus(record);
      expect(status).not.toBe('CONFIRMED');
      expect(status).toBe('PENDING');
    });

    it('should NOT return CONFIRMED when bookingId is 0 (falsy)', () => {
      const record = {
        bookingId: 0 as any,
        calendarEventId: 'cal_abc123',
        needsHuman: false,
        stage: 'booked',
        status: 'active',
      };

      const status = deriveBookingStatus(record);
      expect(status).not.toBe('CONFIRMED');
    });

    it('should NOT return CONFIRMED when calendarEventId is empty string (falsy)', () => {
      const record = {
        bookingId: 123,
        calendarEventId: '',
        needsHuman: false,
        stage: 'booked',
        status: 'active',
      };

      const status = deriveBookingStatus(record);
      expect(status).not.toBe('CONFIRMED');
    });
  });

  describe('isStale flag triggers NEEDS_HUMAN', () => {
    it('should return NEEDS_HUMAN when isStale is true', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        stage: 'choosing_slot',
        status: 'active',
        isStale: true,
      };

      expect(deriveBookingStatus(record)).toBe('NEEDS_HUMAN');
    });

    it('should NOT return NEEDS_HUMAN for stale when already CONFIRMED', () => {
      const record = {
        bookingId: 123,
        calendarEventId: 'cal_abc123',
        needsHuman: false,
        stage: 'booked',
        status: 'active',
        isStale: true,
      };

      expect(deriveBookingStatus(record)).toBe('CONFIRMED');
    });
  });

  describe('other status derivations work correctly', () => {
    it('should return NEEDS_HUMAN when needsHuman is true', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: true,
        stage: 'choosing_slot',
        status: 'active',
      };

      expect(deriveBookingStatus(record)).toBe('NEEDS_HUMAN');
    });

    it('should return NEEDS_HUMAN when lastErrorCode exists', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        lastErrorCode: 'CALENDAR_INSERT_FAILED',
        stage: 'creating_booking',
        status: 'active',
      };

      expect(deriveBookingStatus(record)).toBe('NEEDS_HUMAN');
    });

    it('should return AWAITING_CONFIRM for awaiting_confirm stage', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        stage: 'awaiting_confirm',
        status: 'active',
      };

      expect(deriveBookingStatus(record)).toBe('AWAITING_CONFIRM');
    });

    it('should return ABANDONED for closed without booking', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        stage: null,
        status: 'closed',
      };

      expect(deriveBookingStatus(record)).toBe('ABANDONED');
    });

    it('should return PENDING as default for active in-progress', () => {
      const record = {
        bookingId: null,
        calendarEventId: null,
        needsHuman: false,
        stage: 'selecting_service',
        status: 'active',
      };

      expect(deriveBookingStatus(record)).toBe('PENDING');
    });
  });
});
