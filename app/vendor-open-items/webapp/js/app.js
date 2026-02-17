/**
 * ============================================================
 * BTP Vendor Dashboard - Application Logic
 * 
 * Custom vanilla JS app that connects to CAP OData service
 * and renders vendor line items in a modern dashboard.
 * 
 * Flow: UI → CAP Backend → Destination → Cloud Connector → SAP
 * ============================================================
 */

// ─── State Management ──────────────────────────────────────
const AppState = {
    allData: [],          // Full dataset from API
    filteredData: [],     // After filter/search
    currentFilter: 'all', // all | open | overdue | cleared
    searchQuery: '',
    sortField: 'PostingDate',
    sortDesc: true,
    isLoading: true,
    error: null
};

// ─── API Config ────────────────────────────────────────────
const API_BASE = '../api/vendor';

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('[BTP Dashboard] Initializing...');
    fetchData();
});

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

/**
 * Fetch vendor line items from CAP OData service
 * CAP → Destination Service → Cloud Connector → On-Premise SAP
 */
async function fetchData() {
    showLoading(true);
    hideError();
    hideEmpty();

    try {
        console.log('[BTP Dashboard] Fetching data from:', API_BASE + '/VendorLineItems');

        const response = await fetch(`${API_BASE}/VendorLineItems?$top=500&$orderby=PostingDate desc`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const json = await response.json();
        const data = json.value || json.d?.results || json || [];

        console.log(`[BTP Dashboard] Received ${data.length} records`);

        AppState.allData = data;
        AppState.error = null;

        // Calculate KPIs
        updateKPIs(data);

        // Apply current filters and render
        applyFiltersAndRender();

        // Update connection status
        setConnectionStatus(true);
        updateLastRefresh();

    } catch (error) {
        console.error('[BTP Dashboard] Fetch error:', error);
        AppState.error = error.message;
        showError(error.message);
        setConnectionStatus(false);
    } finally {
        showLoading(false);
    }
}

// ═══════════════════════════════════════════════════════════
// KPI CALCULATIONS
// ═══════════════════════════════════════════════════════════

function updateKPIs(data) {
    const totalItems = data.length;

    let totalAmount = 0;
    let currency = 'TRY';
    const suppliers = new Set();
    let overdueCount = 0;
    let openCount = 0;
    let clearedCount = 0;
    const today = new Date();

    data.forEach(item => {
        totalAmount += parseFloat(item.AmountInCompanyCodeCurrency || 0);
        if (item.CompanyCodeCurrency) currency = item.CompanyCodeCurrency;
        if (item.Supplier) suppliers.add(item.Supplier);

        const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
        if (isCleared) {
            clearedCount++;
        } else {
            const dueDate = item.NetDueDate ? new Date(item.NetDueDate) : null;
            if (dueDate && dueDate < today) {
                overdueCount++;
            } else {
                openCount++;
            }
        }
    });

    // Update DOM
    animateValue('kpiTotalItems', totalItems);
    document.getElementById('kpiTotalAmount').textContent = formatNumber(totalAmount);
    document.getElementById('kpiCurrency').textContent = currency;
    animateValue('kpiSupplierCount', suppliers.size);
    animateValue('kpiOverdueCount', overdueCount);

    // Update chip counts
    document.getElementById('chipCountAll').textContent = totalItems;
    document.getElementById('chipCountOpen').textContent = openCount;
    document.getElementById('chipCountOverdue').textContent = overdueCount;
    document.getElementById('chipCountCleared').textContent = clearedCount;
}

function animateValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 600;
    const start = parseInt(el.textContent) || 0;
    const diff = value - start;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + diff * easedProgress);

        el.textContent = current.toLocaleString('tr-TR');

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════════════════
// FILTERING & SEARCH
// ═══════════════════════════════════════════════════════════

function applyFiltersAndRender() {
    let data = [...AppState.allData];
    const today = new Date();

    // Apply filter
    if (AppState.currentFilter === 'open') {
        data = data.filter(item => {
            const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
            const dueDate = item.NetDueDate ? new Date(item.NetDueDate) : null;
            return !isCleared && (!dueDate || dueDate >= today);
        });
    } else if (AppState.currentFilter === 'overdue') {
        data = data.filter(item => {
            const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
            const dueDate = item.NetDueDate ? new Date(item.NetDueDate) : null;
            return !isCleared && dueDate && dueDate < today;
        });
    } else if (AppState.currentFilter === 'cleared') {
        data = data.filter(item => item.IsCleared === 'X' || item.IsCleared === true);
    }

    // Apply search
    if (AppState.searchQuery) {
        const q = AppState.searchQuery.toLowerCase();
        data = data.filter(item =>
            (item.Supplier || '').toLowerCase().includes(q) ||
            (item.SupplierName || '').toLowerCase().includes(q) ||
            (item.AccountingDocument || '').toLowerCase().includes(q) ||
            (item.DocumentReferenceID || '').toLowerCase().includes(q)
        );
    }

    // Apply sort
    data.sort((a, b) => {
        let valA = a[AppState.sortField];
        let valB = b[AppState.sortField];

        if (AppState.sortField === 'AmountInCompanyCodeCurrency' || AppState.sortField === 'ArrearsInDays') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = (valA || '').toString();
            valB = (valB || '').toString();
        }

        if (valA < valB) return AppState.sortDesc ? 1 : -1;
        if (valA > valB) return AppState.sortDesc ? -1 : 1;
        return 0;
    });

    AppState.filteredData = data;
    renderTable(data);
    updateRecordCount(data.length);

    if (data.length === 0 && AppState.allData.length > 0) {
        showEmpty();
    } else {
        hideEmpty();
    }
}

function setFilter(filter, chipElement) {
    AppState.currentFilter = filter;

    // Update chip active states
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipElement.classList.add('active');

    applyFiltersAndRender();
}

function onSearchInput(value) {
    AppState.searchQuery = value.trim();

    const clearBtn = document.getElementById('searchClear');
    clearBtn.style.display = value ? 'flex' : 'none';

    applyFiltersAndRender();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    AppState.searchQuery = '';
    document.getElementById('searchClear').style.display = 'none';
    applyFiltersAndRender();
}

function onSortChange(value) {
    const [field, direction] = value.split('-');
    AppState.sortField = field;
    AppState.sortDesc = direction === 'desc';
    applyFiltersAndRender();
}

// ═══════════════════════════════════════════════════════════
// TABLE RENDERING
// ═══════════════════════════════════════════════════════════

function renderTable(data) {
    const tbody = document.getElementById('tableBody');

    if (data.length === 0) {
        tbody.innerHTML = '';
        return;
    }

    const today = new Date();

    const rows = data.map((item, index) => {
        const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
        const amount = parseFloat(item.AmountInCompanyCodeCurrency || 0);
        const arrears = parseInt(item.ArrearsInDays || 0);
        const dueDate = item.NetDueDate ? new Date(item.NetDueDate) : null;
        const isOverdue = !isCleared && dueDate && dueDate < today;

        // Status
        let statusClass, statusText;
        if (isCleared) {
            statusClass = 'status-cleared';
            statusText = 'Temizlendi';
        } else if (isOverdue) {
            statusClass = 'status-overdue';
            statusText = 'Gecikmiş';
        } else {
            statusClass = 'status-open';
            statusText = 'Açık';
        }

        // Arrears
        let arrearsClass;
        if (arrears > 30) arrearsClass = 'arrears-danger';
        else if (arrears > 0) arrearsClass = 'arrears-warning';
        else arrearsClass = 'arrears-ok';

        // Amount class
        const amountClass = amount < 0 ? 'negative' : 'positive';

        return `
            <tr style="animation-delay: ${Math.min(index * 0.02, 0.5)}s" onclick="openDetail(${index})">
                <td>
                    <div class="cell-supplier">
                        <span class="supplier-no">${item.Supplier || '-'}</span>
                        <span class="supplier-name">${item.SupplierName || '-'}</span>
                    </div>
                </td>
                <td style="text-align:center">
                    <span class="company-badge">${item.CompanyCode || '-'}</span>
                </td>
                <td>${item.AccountingDocument || '-'}</td>
                <td style="text-align:center">
                    <span class="type-badge">${item.AccountingDocumentType || '-'}</span>
                </td>
                <td>${formatDate(item.PostingDate)}</td>
                <td>${formatDate(item.NetDueDate)}</td>
                <td>
                    <div class="cell-amount ${amountClass}">
                        ${formatNumber(amount)}
                        <span class="cell-currency">${item.CompanyCodeCurrency || ''}</span>
                    </div>
                </td>
                <td style="text-align:center">
                    <span class="arrears-badge ${arrearsClass}">
                        ${arrears > 0 ? arrears + ' gün' : '-'}
                    </span>
                </td>
                <td style="text-align:center">
                    <span class="status-badge ${statusClass}">
                        <span class="status-dot"></span>
                        ${statusText}
                    </span>
                </td>
                <td style="text-align:center">
                    <button class="action-btn" onclick="event.stopPropagation(); openDetail(${index})" title="Detay">
                        <i class="ph ph-arrow-square-out"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

// ═══════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════

function openDetail(index) {
    const item = AppState.filteredData[index];
    if (!item) return;

    const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
    const amount = parseFloat(item.AmountInCompanyCodeCurrency || 0);
    const arrears = parseInt(item.ArrearsInDays || 0);

    let statusHtml;
    if (isCleared) {
        statusHtml = '<span class="status-badge status-cleared"><span class="status-dot"></span>Temizlendi</span>';
    } else if (arrears > 0) {
        statusHtml = '<span class="status-badge status-overdue"><span class="status-dot"></span>Gecikmiş</span>';
    } else {
        statusHtml = '<span class="status-badge status-open"><span class="status-dot"></span>Açık</span>';
    }

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">Satıcı No</span>
                <span class="detail-value">${item.Supplier || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Satıcı Adı</span>
                <span class="detail-value">${item.SupplierName || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Şirket Kodu</span>
                <span class="detail-value">${item.CompanyCode || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Mali Yıl</span>
                <span class="detail-value">${item.FiscalYear || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Belge No</span>
                <span class="detail-value">${item.AccountingDocument || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Belge Kalemi</span>
                <span class="detail-value">${item.AccountingDocumentItem || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Belge Türü</span>
                <span class="detail-value">${item.AccountingDocumentType || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Kayıt Anahtarı</span>
                <span class="detail-value">${item.PostingKey || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Kayıt Tarihi</span>
                <span class="detail-value">${formatDate(item.PostingDate)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Belge Tarihi</span>
                <span class="detail-value">${formatDate(item.DocumentDate)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Vade Başlangıcı</span>
                <span class="detail-value">${formatDate(item.DueCalculationBaseDate)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Net Vade Tarihi</span>
                <span class="detail-value">${formatDate(item.NetDueDate)}</span>
            </div>
            <div class="detail-item full-width" style="margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <span class="detail-label">Tutar</span>
                <span class="detail-value detail-amount" style="color: ${amount < 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">
                    ${formatNumber(amount)} ${item.CompanyCodeCurrency || ''}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">İşlem Tutarı</span>
                <span class="detail-value">${formatNumber(parseFloat(item.AmountInTransactionCurrency || 0))} ${item.TransactionCurrency || ''}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Gecikme (Gün)</span>
                <span class="detail-value">${arrears > 0 ? arrears + ' gün' : '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Durum</span>
                <span class="detail-value">${statusHtml}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Referans</span>
                <span class="detail-value">${item.DocumentReferenceID || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Satınalma Belgesi</span>
                <span class="detail-value">${item.PurchasingDocument || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Fatura Referansı</span>
                <span class="detail-value">${item.InvoiceReference || '-'}</span>
            </div>
        </div>
    `;

    document.getElementById('detailModal').classList.add('open');
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('detailModal').classList.remove('open');
}

// Close modal with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ═══════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════

function exportExcel() {
    const data = AppState.filteredData;
    if (data.length === 0) {
        alert('Dışa aktarılacak veri yok.');
        return;
    }

    // CSV export as fallback (no external library needed)
    const headers = [
        'Satıcı No', 'Satıcı Adı', 'Şirket Kodu', 'Belge No', 'Belge Türü',
        'Kayıt Tarihi', 'Vade Tarihi', 'Tutar', 'Para Birimi', 'Gecikme (Gün)', 'Durum'
    ];

    const rows = data.map(item => {
        const isCleared = item.IsCleared === 'X' || item.IsCleared === true;
        const arrears = parseInt(item.ArrearsInDays || 0);
        const status = isCleared ? 'Temizlendi' : arrears > 0 ? 'Gecikmiş' : 'Açık';

        return [
            item.Supplier || '',
            item.SupplierName || '',
            item.CompanyCode || '',
            item.AccountingDocument || '',
            item.AccountingDocumentType || '',
            item.PostingDate || '',
            item.NetDueDate || '',
            item.AmountInCompanyCodeCurrency || '0',
            item.CompanyCodeCurrency || '',
            item.ArrearsInDays || '0',
            status
        ].map(v => `"${v}"`).join(';');
    });

    const BOM = '\uFEFF';
    const csv = BOM + headers.join(';') + '\n' + rows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `satici_kalemleri_${formatDateForFile(new Date())}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    console.log(`[BTP Dashboard] Exported ${data.length} records to CSV`);
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════

function showLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (show) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
    } else {
        el.classList.add('hidden');
        el.style.display = 'none'; // KRİTİK DÜZELTME: Inline stili ez ve gizle
    }
    AppState.isLoading = show;
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message || 'Bilinmeyen hata';
    document.getElementById('errorState').style.display = 'flex';
    document.getElementById('tableWrapper').style.display = 'none';
}

function hideError() {
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('tableWrapper').style.display = '';
}

function showEmpty() {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('tableWrapper').style.display = 'none';
}

function hideEmpty() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('tableWrapper').style.display = '';
}

function updateRecordCount(count) {
    document.getElementById('recordCount').textContent = `${count.toLocaleString('tr-TR')} kayıt`;
}

function setConnectionStatus(connected) {
    const badge = document.getElementById('connectionBadge');
    const dot = badge.querySelector('.pulse-dot');
    const text = badge.querySelector('span');

    if (connected) {
        badge.style.borderColor = 'rgba(52, 211, 153, 0.2)';
        badge.style.background = 'rgba(52, 211, 153, 0.08)';
        badge.style.color = 'var(--accent-green)';
        dot.style.background = 'var(--accent-green)';
        text.textContent = 'Bağlı';
    } else {
        badge.style.borderColor = 'rgba(248, 113, 113, 0.2)';
        badge.style.background = 'rgba(248, 113, 113, 0.08)';
        badge.style.color = 'var(--accent-red)';
        dot.style.background = 'var(--accent-red)';
        text.textContent = 'Bağlantı Yok';
    }
}

function updateLastRefresh() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent =
        now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function refreshData() {
    const btn = document.querySelector('.header-btn');
    btn.classList.add('refreshing');

    fetchData().finally(() => {
        setTimeout(() => btn.classList.remove('refreshing'), 500);
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0,00';
    return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        // Handle /Date(...)/ format from OData v2
        if (dateStr.includes && dateStr.includes('/Date(')) {
            const ms = parseInt(dateStr.replace(/\/Date\((\d+)\)\//, '$1'));
            const date = new Date(ms);
            return date.toLocaleDateString('tr-TR');
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('tr-TR');
    } catch {
        return dateStr;
    }
}

function formatDateForFile(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}
