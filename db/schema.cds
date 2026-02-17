/* ============================================================
 * Database Schema (Projection)
 * Description: Local projections for caching or extending
 *              external vendor open items data
 * ============================================================ */

namespace btp.api.db;

using { cuid, managed } from '@sap/cds/common';

/**
 * Audit Log Entity - Track API call history
 * Her API çağrısını loglar
 */
entity AuditLog : cuid, managed {
    action      : String(50);
    userId      : String(100);
    status      : String(20);
    details     : LargeString;
    timestamp   : Timestamp;
}
