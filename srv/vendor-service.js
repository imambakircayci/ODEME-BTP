/**
 * ============================================================
 * Vendor Line Items Service Handler
 * 
 * Production Ready Implementation
 * - SAP Cloud SDK (executeHttpRequest) kullanımı
 * - BTP Destination & Cloud Connector entegrasyonu
 * - Manuel URL inşası (Encoding sorunlarını önlemek için)
 * - Kapsamlı hata yönetimi ve loglama
 * 
 * @version 8.0.0
 * ============================================================
 */

const cds = require('@sap/cds');
const LOG = cds.log('vendor-service');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

class VendorLineItemsService extends cds.ApplicationService {

    async init() {
        LOG.info('✅ VendorLineItemsService başlatıldı (Production Mode)');
        const { VendorLineItems } = this.entities;

        // READ handler
        this.on('READ', VendorLineItems, (req) => this._handleReadVendorLineItems(req));

        // Summary handler
        this.on('getItemsSummary', (req) => this._handleGetSummary(req));

        await super.init();
    }

    /**
     * SAP'den veri çeken ana fonksiyon
     * @param {string} path - Sorgu yolu (Query string dahil)
     */
    async _fetchFromSAP(path) {
        LOG.info('📤 SAP İsteği Gönderiliyor:', path);

        try {
            const response = await executeHttpRequest(
                {
                    destinationName: 'EXTERNAL_ONPREM_API'
                },
                {
                    method: 'GET',
                    url: path,
                    headers: {
                        'Accept': 'application/json'
                    }
                },
                {
                    // CSRF token sadece modifikasyon (POST/PUT) için gereklidir
                    fetchCsrfToken: false
                }
            );

            // Gelen veriyi işle
            const data = response.data;
            let items = [];

            if (data?.d?.results) {
                items = data.d.results;
            } else if (data?.d) {
                items = Array.isArray(data.d) ? data.d : [data.d];
            } else if (Array.isArray(data)) {
                items = data;
            }

            LOG.info(`📥 SAP'tan ${items.length} kayıt başarıyla döndü`);

            // İlk kaydı analiz için logla
            if (items.length > 0) {
                LOG.info('🔍 İLK KAYIT KEYS:', Object.keys(items[0]).join(', '));
            }

            return items;

        } catch (error) {
            this._logError(error);
            const err = new Error('SAP Sisteminden veri çekilemedi');
            err.code = 502;
            throw err;
        }
    }

    async _handleReadVendorLineItems(req) {
        LOG.info('⚡ READ isteği işleniyor');
        LOG.info('   Kullanıcı:', req.user?.id || 'Anonim');

        const queryParams = [
            "sap-client=100",
            "$filter=Supplier eq '2007' and FinancialAccountType eq 'K' and ClearingAccountingDocument eq ''",
            "$top=500",
            "$format=json"
        ].join('&');

        const fullPath = `/sap/opu/odata/sap/FAP_VENDOR_LINE_ITEMS_SRV/Items?${queryParams}`;

        const rawItems = await this._fetchFromSAP(fullPath);

        // Mapping işlemi
        return rawItems.map(item => this._mapSAPItem(item));
    }

    async _handleGetSummary(req) {
        LOG.info('📊 Özet Rapor İsteği');

        const queryParams = [
            "sap-client=100",
            "$filter=Supplier eq '2007' and FinancialAccountType eq 'K' and ClearingAccountingDocument eq ''",
            "$top=1000",
            "$format=json"
        ].join('&');

        const fullPath = `/sap/opu/odata/sap/FAP_VENDOR_LINE_ITEMS_SRV/Items?${queryParams}`;

        const rawItems = await this._fetchFromSAP(fullPath);

        if (!rawItems || rawItems.length === 0) return [];

        const summaryMap = new Map();
        const today = new Date();

        for (const item of rawItems) {
            // Supplier alanı yoksa alternatiflere bak
            const supplierKey = item.Supplier || item.Vendor || item.LIFNR || 'UNKNOWN';

            if (!summaryMap.has(supplierKey)) {
                summaryMap.set(supplierKey, {
                    Supplier: supplierKey,
                    SupplierName: item.SupplierName || item.Name1 || item.NAME1 || '',
                    TotalAmount: 0,
                    Currency: item.CompanyCodeCurrency || item.Currency || 'TRY',
                    ItemCount: 0,
                    OverdueCount: 0
                });
            }

            const s = summaryMap.get(supplierKey);
            const amount = parseFloat(item.AmountInCompanyCodeCurrency || item.Amount || item.DMBTR || 0);

            s.TotalAmount += amount;
            s.ItemCount++;

            const due = this._parseDate(item.NetDueDate);
            if (due && new Date(due) < today) s.OverdueCount++;
        }

        const result = Array.from(summaryMap.values());
        LOG.info(`✅ Özet: ${result.length} satıcı`);
        return result;
    }

    _mapSAPItem(item) {
        // Büyük harf/küçük harf duyarlılığını aşmak için helper
        const getVal = (keys) => {
            for (const k of keys) {
                if (item[k] !== undefined && item[k] !== null) return item[k];
            }
            return '';
        };

        return {
            GeneratedID: item.GeneratedID || `${getVal(['AccountingDocument', 'BELNR'])}_${getVal(['FiscalYear', 'GJAHR'])}_${getVal(['AccountingDocumentItem', 'BUZEI'])}`,

            CompanyCode: getVal(['CompanyCode', 'BUKRS']),
            Supplier: getVal(['Supplier', 'Vendor', 'LIFNR']),
            SupplierName: getVal(['SupplierName', 'Name1', 'NAME1']),

            FiscalYear: getVal(['FiscalYear', 'GJAHR']),
            AccountingDocument: getVal(['AccountingDocument', 'BELNR']),
            AccountingDocumentItem: getVal(['AccountingDocumentItem', 'BUZEI']),
            AccountingDocumentType: getVal(['AccountingDocumentType', 'BLART']),

            DocumentDate: this._parseDate(getVal(['DocumentDate', 'BLDAT'])),
            PostingDate: this._parseDate(getVal(['PostingDate', 'BUDAT'])),
            NetDueDate: this._parseDate(getVal(['NetDueDate', 'NETDT'])),

            AmountInCompanyCodeCurrency: parseFloat(getVal(['AmountInCompanyCodeCurrency', 'Amount', 'DMBTR']) || 0),
            CompanyCodeCurrency: getVal(['CompanyCodeCurrency', 'Currency', 'WAERS', 'HWAER']) || 'TRY',

            AmountInTransactionCurrency: parseFloat(getVal(['AmountInTransactionCurrency', 'WRBTR']) || 0),
            TransactionCurrency: getVal(['TransactionCurrency', 'WAERS']),

            PurchasingDocument: getVal(['PurchasingDocument', 'EBELN']),
            DocumentReferenceID: getVal(['DocumentReferenceID', 'XBLNR']),

            ClearingAccountingDocument: getVal(['ClearingAccountingDocument', 'AUGBL']),
            ClearingDate: this._parseDate(getVal(['ClearingDate', 'AUGDT'])),
            IsCleared: getVal(['IsCleared', 'AUGBL']) ? true : false, // AUGBL doluysa cleared

            PostingKey: getVal(['PostingKey', 'BSCHL']),
            NetPaymentDays: parseInt(getVal(['NetPaymentDays', 'ZBD1T']) || 0),
            DueCalculationBaseDate: this._parseDate(getVal(['DueCalculationBaseDate', 'ZFBDT'])),
            PaymentBlockingReason: getVal(['PaymentBlockingReason', 'ZLSPR']),
            InvoiceReference: getVal(['InvoiceReference', 'REBZG']),
            DebitCreditCode: getVal(['DebitCreditCode', 'SHKZG']),
            FinancialAccountType: getVal(['FinancialAccountType', 'KOART']),
            SpecialGeneralLedgerCode: getVal(['SpecialGeneralLedgerCode', 'UMSKZ']),
            DocumentItemText: getVal(['DocumentItemText', 'SGTXT'])
        };
    }

    _parseDate(dateValue) {
        if (!dateValue) return null;
        if (typeof dateValue === 'string' && dateValue.startsWith('/Date(')) {
            const match = dateValue.match(/\/Date\((-?\d+)\)\//);
            if (match) return new Date(parseInt(match[1])).toISOString().split('T')[0];
        }
        if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            return dateValue.split('T')[0]; // Zaten formatlı
        }
        // SAP formatı: YYYYMMDD
        if (typeof dateValue === 'string' && dateValue.length === 8 && !isNaN(dateValue)) {
            return `${dateValue.substring(0, 4)}-${dateValue.substring(4, 6)}-${dateValue.substring(6, 8)}`;
        }
        return dateValue;
    }

    _logError(error) {
        LOG.error('❌ SAP Bağlantı Hatası');
        if (error.response) {
            LOG.error('   Status:', error.response.status);
            try {
                const body = JSON.stringify(error.response.data);
                LOG.error('   Body:', body.substring(0, 1000));
            } catch (e) {
                LOG.error('   Body (raw):', error.response.data);
            }
        } else {
            LOG.error('   Mesaj:', error.message);
        }
    }
}

module.exports = { VendorLineItemsService };
