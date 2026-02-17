/* ============================================================
 * Vendor Line Items Service Definition
 * 
 * Bu servis CAP Application Service olarak tanımlanır.
 * Entity standalone'dır - external projection YOKTUR.
 * 
 * Neden projection kullanmıyoruz?
 *   Items entity'si SAP'ta aggregate (analitik) bir entity'dir.
 *   CAP, projection gördüğünde sorguyu otomatik olarak external
 *   servise iletmeye çalışır. Bu süreçte OData dönüşümü aggregate
 *   entity ile uyumsuz olduğundan 400 hatası verir.
 * 
 *   Çözüm: Entity'yi standalone tanımlayıp, custom handler ile
 *   SAP Cloud SDK üzerinden doğrudan SAP'a istek atıyoruz.
 *   Destination ve Cloud Connector hâlâ kullanılır.
 * 
 * API: FAP_VENDOR_LINE_ITEMS_SRV (SAP On-Premise)
 * Bağlantı: BTP Destination → Cloud Connector → On-Prem
 * ============================================================ */

@path: '/api/vendor'
@requires: 'authenticated-user'
service VendorLineItemsService {

    /**
     * VendorLineItems - Standalone Entity
     * Tüm veri akışı vendor-service.js handler'ında yönetilir.
     */
    @readonly
    entity VendorLineItems {
        key GeneratedID              : String;
            CompanyCode              : String(4);
            Supplier                 : String(10);
            SupplierName             : String(80);
            FiscalYear               : String(4);
            AccountingDocument       : String(10);
            AccountingDocumentItem   : String(3);
            AccountingDocumentType   : String(2);
            DocumentDate             : Date;
            PostingDate              : Date;
            NetDueDate               : Date;
            AmountInCompanyCodeCurrency : Decimal(24, 3);
            CompanyCodeCurrency      : String(5);
            AmountInTransactionCurrency : Decimal(24, 3);
            TransactionCurrency      : String(5);
            PurchasingDocument       : String(10);
            DocumentReferenceID      : String(16);
            ClearingAccountingDocument : String(10);
            ClearingDate             : Date;
            IsCleared                : String(1);
            PostingKey               : String(2);
            NetPaymentDays           : Integer;
            DueCalculationBaseDate   : Date;
            PaymentBlockingReason    : String(1);
            InvoiceReference         : String(10);
            DebitCreditCode          : String(1);
            FinancialAccountType     : String(1);
            SpecialGeneralLedgerCode : String(1);
            DocumentItemText         : String(50);
    };

    /**
     * Function: getItemsSummary
     * Satıcı bazlı özet bilgileri döner
     */
    function getItemsSummary() returns array of {
        Supplier         : String;
        SupplierName     : String;
        TotalAmount      : Decimal;
        Currency         : String;
        ItemCount        : Integer;
        OverdueCount     : Integer;
    };
}
