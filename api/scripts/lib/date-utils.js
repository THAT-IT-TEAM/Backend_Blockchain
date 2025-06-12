const { format, parse, add, sub, differenceInMilliseconds, formatDistanceToNow } = require('date-fns');
const { utcToZonedTime, format: tzFormat } = require('date-fns-tz');

class DateUtils {
  /**
   * Format a date to the specified format
   */
  static formatDate(date, formatStr = 'yyyy-MM-dd', timezone = 'UTC') {
    try {
      const d = this.parseDate(date);
      if (timezone === 'UTC') {
        return format(d, formatStr);
      }
      const zonedDate = utcToZonedTime(d, timezone);
      return tzFormat(zonedDate, formatStr, { timeZone: timezone });
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  }

  /**
   * Parse a date string or timestamp into a Date object
   */
  static parseDate(date) {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);
    if (typeof date === 'string') {
      // Try parsing ISO string
      const isoDate = new Date(date);
      if (!isNaN(isoDate.getTime())) return isoDate;
      
      // Try common formats
      const formats = [
        'yyyy-MM-dd',
        'MM/dd/yyyy',
        'dd/MM/yyyy',
        'yyyy/MM/dd',
        'yyyy-MM-dd HH:mm:ss',
        'MM/dd/yyyy HH:mm:ss',
        'dd/MM/yyyy HH:mm:ss',
        'yyyy/MM/dd HH:mm:ss',
        'yyyy-MM-dd HH:mm:ss.SSS',
      ];
      
      for (const fmt of formats) {
        try {
          const parsed = parse(date, fmt, new Date());
          if (!isNaN(parsed.getTime())) return parsed;
        } catch (e) {
          // Try next format
        }
      }
    }
    throw new Error(`Invalid date format: ${date}`);
  }

  /**
   * Get the current timestamp in milliseconds
   */
  static getTimestamp(date = new Date()) {
    return this.parseDate(date).getTime();
  }

  /**
   * Add time to a date
   */
  static addTime(date, amount, unit = 'days') {
    const d = this.parseDate(date);
    return add(d, { [unit]: amount });
  }

  /**
   * Subtract time from a date
   */
  static subTime(date, amount, unit = 'days') {
    const d = this.parseDate(date);
    return sub(d, { [unit]: amount });
  }

  /**
   * Get the difference between two dates in the specified unit
   */
  static diff(date1, date2, unit = 'milliseconds') {
    const d1 = this.parseDate(date1);
    const d2 = this.parseDate(date2);
    
    const diffMs = differenceInMilliseconds(d1, d2);
    
    switch (unit) {
      case 'milliseconds':
        return diffMs;
      case 'seconds':
        return Math.floor(diffMs / 1000);
      case 'minutes':
        return Math.floor(diffMs / (1000 * 60));
      case 'hours':
        return Math.floor(diffMs / (1000 * 60 * 60));
      case 'days':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'months':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
      case 'years':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
  }

  /**
   * Format a date as a relative time string (e.g., "2 days ago")
   */
  static timeAgo(date, options = {}) {
    const d = this.parseDate(date);
    return formatDistanceToNow(d, { 
      addSuffix: true,
      ...options 
    });
  }

  /**
   * Check if a date is between two other dates
   */
  static isBetween(date, start, end) {
    const d = this.getTimestamp(date);
    const s = this.getTimestamp(start);
    const e = this.getTimestamp(end);
    return d >= s && d <= e;
  }

  /**
   * Get the start of a time period
   */
  static startOf(date, unit = 'day') {
    const d = this.parseDate(date);
    
    switch (unit) {
      case 'second':
        d.setMilliseconds(0);
        break;
      case 'minute':
        d.setSeconds(0, 0);
        break;
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        break;
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'quarter':
        d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'year':
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return d;
  }

  /**
   * Get the end of a time period
   */
  static endOf(date, unit = 'day') {
    const d = this.parseDate(date);
    
    switch (unit) {
      case 'second':
        d.setMilliseconds(999);
        break;
      case 'minute':
        d.setSeconds(59, 999);
        break;
      case 'hour':
        d.setMinutes(59, 59, 999);
        break;
      case 'day':
        d.setHours(23, 59, 59, 999);
        break;
      case 'week':
        d.setDate(d.getDate() + (6 - d.getDay()));
        d.setHours(23, 59, 59, 999);
        break;
      case 'month':
        d.setMonth(d.getMonth() + 1, 0);
        d.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        d.setMonth(Math.ceil((d.getMonth() + 1) / 3) * 3, 0);
        d.setHours(23, 59, 59, 999);
        break;
      case 'year':
        d.setMonth(11, 31);
        d.setHours(23, 59, 59, 999);
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    
    return d;
  }

  /**
   * Convert a date to a different timezone
   */
  static convertToTimezone(date, timezone) {
    const d = this.parseDate(date);
    return utcToZonedTime(d, timezone);
  }

  /**
   * Check if a year is a leap year
   */
  static isLeapYear(date) {
    const year = date instanceof Date ? date.getFullYear() : date;
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Get the number of days in a month
   */
  static getDaysInMonth(date) {
    const d = this.parseDate(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  /**
   * Get the human-readable timezone name
   */
  static getTimezoneName() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Get the current timezone offset in minutes
   */
  static getTimezoneOffset(date = new Date()) {
    return date.getTimezoneOffset();
  }

  /**
   * Check if daylight saving time is in effect for a date
   */
  static isDST(date = new Date()) {
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== date.getTimezoneOffset();
  }
}

module.exports = DateUtils;
