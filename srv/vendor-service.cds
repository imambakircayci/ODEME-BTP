using { FAP_VENDOR_LINE_ITEMS_SRV as external } from './external/FAP_VENDOR_LINE_ITEMS_SRV';
using { btp.api.db as db } from '../db/schema';

// Servis Tanımı
service VendorLineItemsService @(path: '/api/vendor') {

    // 1. External SAP Entity (Read-Only)
    @readonly
    entity VendorLineItems as projection on external.Items {
        key CompanyCode,
        key AccountingDocument,
        key FiscalYear,
        key AccountingDocumentItem,
        Supplier,
        SupplierName,
        AmountInCompanyCodeCurrency,
        CompanyCodeCurrency,
        DocumentDate,
        NetDueDate,
        FinancialAccountType,
        ClearingAccountingDocument
    };

    // 2. Local HANA Tables (CRUD Enabled)
    entity ApproverGroups as projection on db.ApproverGroups;
    entity ApproverUsers as projection on db.ApproverUsers;
    entity GroupDetermination as projection on db.GroupDetermination;
    entity ApprovalDetermination as projection on db.ApprovalDetermination;

    // 3. Custom Functions
    function getItemsSummary() returns array of {
        Supplier: String;
        SupplierName: String;
        TotalAmount: Decimal(15,2);
        Currency: String;
        ItemCount: Integer;
    };
}
