/**
 * BTP Vendor Dashboard Logic
 * HANA Cloud Integration with Modern SM30 Style Editor
 * Best Practices: CSRF Protection & Enhanced Error Handling (Wait-Safe)
 */

// STATE MANAGEMENT
const AppState = {
    ApproverGroups: [],
    ApproverUsers: [],
    GroupDetermination: [],
    ApprovalDetermination: [],
    vendors: [],
    selectedVendor: null,
    currentView: 'page-approval',
    activeConfigTable: 'ApproverGroups'
};

// ---------------------------------------------------------
// ROUTER (VIEW MANAGER)
// ---------------------------------------------------------
const Router = {
    init: function () {
        this.navigate('page-approval');
        DataService.fetchVendors();
    },

    navigate: function (viewId) {
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            target.style.display = 'flex';
        }

        document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
        const menuIndex = viewId === 'page-approval' ? 0 : (viewId === 'page-settings' ? 1 : 2);
        const menuItem = document.querySelectorAll('.menu-item')[menuIndex];
        if (menuItem) menuItem.classList.add('active');

        if (viewId === 'page-settings') {
            Config.openTab(document.querySelector('.tab-btn.active'), AppState.activeConfigTable);
        }
    }
};

// ---------------------------------------------------------
// CONFIG PAGE CONTROLLER (HANA CRUD Logic)
// ---------------------------------------------------------
const Config = {
    activeTable: 'ApproverGroups',

    openTab: function (tabBtn, tableName) {
        if (!tabBtn) return;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');

        this.activeTable = tableName;
        AppState.activeConfigTable = tableName;

        DataService.fetchConfigTable(tableName).then(() => {
            this.renderTable(tableName);
        });
    },

    renderTable: function (tableName) {
        const container = document.getElementById('configTableContainer');
        if (!container) return;

        const data = AppState[tableName] || [];

        let columns = [];
        let icon = '';
        let title = '';

        if (tableName === 'ApproverGroups') {
            title = 'ONAYCI GRUPLARI';
            icon = 'fa-users-gear';
            columns = [
                { key: 'GroupCode', label: 'GRUP KODU', type: 'text', width: '150px' },
                { key: 'Description', label: 'TANIM', type: 'text' }
            ];
        } else if (tableName === 'ApproverUsers') {
            title = 'ONAYCI KULLANICILARI';
            icon = 'fa-user-tag';
            const groupOptions = (AppState.ApproverGroups || []).map(g => g.GroupCode);
            columns = [
                { key: 'Group_GroupCode', label: 'GRUP KODU', type: 'select', options: groupOptions, width: '200px' },
                { key: 'Counter', label: 'SIRA', type: 'number', width: '100px' },
                { key: 'Username', label: 'KULLANICI (SAP ID)', type: 'text', width: '200px' },
                { key: 'LimitAmount', label: 'ONAY LİMİTİ', type: 'number' }
            ];
        } else {
            title = tableName;
            icon = 'fa-table';
        }

        const toolbarHtml = `
            <h3><i class="fa-solid ${icon}"></i> ${title}</h3>
            <div style="flex:1"></div>
            <button class="btn btn-sm btn-outline success" onclick="Config.saveNewRow()">
                <i class="fa-solid fa-floppy-disk"></i> Kaydet (Yeni)
            </button>
            <button class="btn btn-sm btn-primary" onclick="Config.addNewRowUI()">
                <i class="fa-solid fa-plus"></i> Yeni Giriş
            </button>
            <button class="btn btn-sm btn-outline danger" onclick="Config.deleteSelectedRows()">
                <i class="fa-solid fa-trash-can"></i> Sil
            </button>
        `;
        const toolbar = document.querySelector('.table-toolbar');
        if (toolbar) toolbar.innerHTML = toolbarHtml;

        let html = `
            <table class="modern-grid">
                <thead>
                    <tr>
                        <th class="check-col"><input type="checkbox" onchange="Config.selectAll(this)"></th>
                        ${columns.map(c => `<th style="width:${c.width || 'auto'}">${c.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        if (data.length === 0) {
            html += `<tr><td colspan="${columns.length + 1}" class="empty-placeholder"><i class="fa-solid fa-database"></i><br>Kayıt Yok.</td></tr>`;
        } else {
            data.forEach((row, index) => {
                const isNew = row._isNew ? 'style="background:rgba(16, 185, 129, 0.1)"' : '';
                html += `<tr ${isNew}>
                    <td class="check-col">
                        <div class="cell-wrapper" style="justify-content:center">
                            <input type="checkbox" class="config-row-select" data-index="${index}">
                        </div>
                    </td>
                    ${columns.map(col => `
                        <td>${this.renderInput(col, row[col.key], index)}</td>
                    `).join('')}
                </tr>`;
            });
        }

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    renderInput: function (col, value, rowIndex) {
        if (col.type === 'select') {
            return `
                <select onchange="Config.updateCell('${col.key}', ${rowIndex}, this.value)">
                    <option value="" disabled ${!value ? 'selected' : ''}>Seçiniz</option>
                    ${(col.options || []).map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;
        } else {
            return `<input type="${col.type}" value="${value || ''}" placeholder="..." 
                    onchange="Config.updateCell('${col.key}', ${rowIndex}, this.value)">`;
        }
    },

    addNewRowUI: function () {
        const newRow = { _isNew: true };
        if (!AppState[this.activeTable]) AppState[this.activeTable] = [];
        AppState[this.activeTable].push(newRow);
        this.renderTable(this.activeTable);
    },

    updateCell: function (key, index, value) {
        if (AppState[this.activeTable][index]) {
            AppState[this.activeTable][index][key] = value;
        }
    },

    selectAll: function (source) {
        const checkboxes = document.querySelectorAll('.config-row-select');
        checkboxes.forEach(cb => cb.checked = source.checked);
    },

    saveNewRow: async function () {
        const newRows = AppState[this.activeTable].filter(r => r._isNew);
        if (newRows.length === 0) { alert("Kaydedilecek yeni giriş yok."); return; }

        const btn = document.querySelector('.btn-outline.success');
        const oldContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
        btn.disabled = true;

        try {
            await DataService.createConfigRows(this.activeTable, newRows);
            alert("Kayıt Başarılı!");
            // Tabloyu yenile
            await DataService.fetchConfigTable(this.activeTable);
            this.renderTable(this.activeTable);
        } catch (e) {
            alert("Hata: " + e.message);
        } finally {
            btn.innerHTML = oldContent;
            btn.disabled = false;
        }
    },

    deleteSelectedRows: async function () {
        const checkboxes = document.querySelectorAll('.config-row-select:checked');
        if (checkboxes.length === 0) return;

        if (!confirm(`${checkboxes.length} kaydı silmek istediğinize emin misiniz?`)) return;

        const toDelete = Array.from(checkboxes).map(cb => AppState[this.activeTable][cb.dataset.index]);

        try {
            await DataService.deleteConfigRows(this.activeTable, toDelete);
            alert("Silme Başarılı!");
            await DataService.fetchConfigTable(this.activeTable);
            this.renderTable(this.activeTable);
        } catch (e) {
            alert("Silme Hatası: " + e.message);
        }
    }
};

// ---------------------------------------------------------
// DATA SERVICE (ODATA V4)
// ---------------------------------------------------------
const DataService = {
    csrfToken: null,

    getCsrfToken: async function () {
        if (this.csrfToken) return this.csrfToken;
        try {
            const res = await fetch('/api/vendor/', {
                method: 'HEAD',
                headers: { 'x-csrf-token': 'fetch' }
            });
            this.csrfToken = res.headers.get('x-csrf-token');
            return this.csrfToken;
        } catch (e) {
            console.warn("CSRF Token alınamadı", e);
            return null;
        }
    },

    fetchConfigTable: async function (tableName) {
        try {
            const response = await fetch(`/api/vendor/${tableName}`);
            if (!response.ok) return [];
            const data = await response.json();
            AppState[tableName] = data.value || [];
            return AppState[tableName];
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    createConfigRows: async function (tableName, rows) {
        const token = await this.getCsrfToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['x-csrf-token'] = token;

        for (const row of rows) {
            const { _isNew, ...payload } = row;
            if (tableName === 'ApproverUsers') {
                payload.Counter = parseInt(payload.Counter) || 1;
                payload.LimitAmount = parseFloat(payload.LimitAmount) || 0;
            }
            const response = await fetch(`/api/vendor/${tableName}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMsg = "Kayıt Başarısız";
                const responseBody = await response.text();
                try {
                    const err = JSON.parse(responseBody);
                    errorMsg = err.error?.message || response.statusText;
                } catch {
                    errorMsg = responseBody || response.statusText;
                }
                throw new Error(errorMsg);
            }
        }
    },

    deleteConfigRows: async function (tableName, rows) {
        const token = await this.getCsrfToken();
        const headers = {};
        if (token) headers['x-csrf-token'] = token;

        for (const row of rows) {
            let url = `/api/vendor/${tableName}`;
            if (row._isNew) continue;

            if (tableName === 'ApproverGroups') {
                url += `('${row.GroupCode}')`;
            } else if (tableName === 'ApproverUsers') {
                if (row.ID) {
                    url += `(${row.ID})`;
                } else {
                    console.error("ID bulunamadı, silinemedi", row);
                    continue;
                }
            }

            const response = await fetch(url, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Silme Başarısız");
            }
        }
    },

    fetchVendors: async function () {
        UI.showLoading(true);
        try {
            const response = await fetch('/api/vendor/getItemsSummary()');
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            AppState.vendors = data.value || data || [];
            UI.renderVendorList(AppState.vendors);
        } catch (err) {
            console.error(err);
            document.getElementById('vendorListContainer').innerHTML =
                `<div class="empty-state" style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i><br>Verilere Erişilemiyor</div>`;
        } finally {
            UI.showLoading(false);
        }
    },

    fetchVendorDetails: async function (supplierId) {
        UI.showLoading(true);
        try {
            const filter = `$filter=Supplier eq '${supplierId}'`;
            const response = await fetch(`/api/vendor/VendorLineItems?${filter}`);
            if (!response.ok) throw new Error("Detay Hatası");
            const data = await response.json();
            UI.renderLineItems(data.value || []);
        } catch (err) {
            document.getElementById('lineItemsTableBody').innerHTML =
                `<tr><td colspan="7" class="empty-state">Detay yüklenemedi.</td></tr>`;
        } finally {
            UI.showLoading(false);
        }
    }
};

// ... UI ve EventListener aynı ...
const UI = {
    showLoading: function (show) {
        const el = document.getElementById('loadingOverlay');
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    },
    formatMoney: function (amount, currency) {
        try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY' }).format(amount); } catch (e) { return amount; }
    },
    formatDate: function (dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('tr-TR');
    },
    renderVendorList: function (vendors) {
        const container = document.getElementById('vendorListContainer');
        container.innerHTML = '';
        if (!vendors || vendors.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i><br>Kayıt Bulunamadı</div>'; return;
        }
        vendors.forEach(v => {
            const div = document.createElement('div');
            div.className = 'vendor-item';
            div.onclick = () => this.selectVendor(v, div);
            div.innerHTML = `
                <span class="v-amount">${this.formatMoney(v.TotalAmount, v.Currency)}</span>
                <span class="v-name">${v.SupplierName || v.Supplier}</span>
                <span class="v-code"><i class="fa-solid fa-hashtag" style="font-size:10px"></i> ${v.Supplier} • ${v.ItemCount} Belge</span>
            `;
            container.appendChild(div);
        });
    },
    selectVendor: function (vendor, domElement) {
        document.querySelectorAll('.vendor-item').forEach(el => el.classList.remove('active'));
        if (domElement) domElement.classList.add('active');
        AppState.selectedVendor = vendor;
        document.getElementById('selectedVendorName').innerText = vendor.SupplierName || vendor.Supplier;
        document.getElementById('selectedVendorId').innerText = vendor.Supplier;
        document.getElementById('selectedVendorTotal').innerText = this.formatMoney(vendor.TotalAmount, vendor.Currency);
        DataService.fetchVendorDetails(vendor.Supplier);
    },
    renderLineItems: function (items) {
        const tbody = document.getElementById('lineItemsTableBody');
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Bu satıcı için açık kalem yok.</td></tr>'; return;
        }
        items.forEach(item => {
            const tr = document.createElement('tr');
            let statusBadge = '<span style="color:var(--success); font-weight:600"><i class="fa-solid fa-check"></i> Güncel</span>';
            if (item.NetDueDate && new Date(item.NetDueDate) < new Date()) {
                statusBadge = '<span style="color:var(--danger); font-weight:600"><i class="fa-solid fa-clock"></i> Gecikmiş</span>';
            }
            tr.innerHTML = `<td><input type="checkbox" class="row-select"></td><td><b>${item.AccountingDocument}</b></td><td>${this.formatDate(item.DocumentDate)}</td><td>${this.formatDate(item.NetDueDate)}</td>
                <td style="font-weight:700; color:var(--text-primary)">${this.formatMoney(item.AmountInCompanyCodeCurrency, item.CompanyCodeCurrency)}</td><td>${item.CompanyCodeCurrency}</td><td>${statusBadge}</td>`;
            tbody.appendChild(tr);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Router.init();
    const searchInput = document.getElementById('vendorSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.vendor-item').forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? 'block' : 'none';
            });
        });
    }
});

window.Router = Router;
window.Config = Config;
