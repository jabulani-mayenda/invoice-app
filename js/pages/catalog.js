/* ============================================
   KWEZA - CATALOG PAGE
   ============================================ */

const CATALOG_CATEGORIES = [
  'Designing',
  'Consultation',
  'Business Services',
  'Packages',
  'Add-ons',
  'Custom Projects',
  'Merchandise',
  'Other'
];

async function renderCatalog() {
  const { db, getAllDepartments } = window.KwezaDB;
  const [items, departments] = await Promise.all([
    db.catalog.orderBy('category').toArray(),
    getAllDepartments()
  ]);

  const grouped = {};
  const departmentMap = Object.fromEntries(departments.map(department => [department.id, department]));
  items.forEach(item => {
    (grouped[item.category] = grouped[item.category] || []).push(item);
  });

  const page = document.getElementById('catalog-page');
  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Product & Service Catalog</h2>
        <p>${items.length} item${items.length !== 1 ? 's' : ''} shared for quotations and invoices</p>
      </div>
      <button class="btn btn-primary" onclick="openCatalogModal()">+ Add Item</button>
    </div>

    ${items.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Catalog is empty</h3><p>Save your services here for one-tap use in quotations and invoices.</p>
         <button class="btn btn-primary mt-12" onclick="openCatalogModal()">+ Add Your First Service</button></div>`
      : Object.entries(grouped).map(([category, categoryItems]) => `
        <div class="mb-20">
          <div class="text-muted text-sm font-semibold" style="text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">${category}</div>
          <div class="grid grid-3">${categoryItems.map(item => catalogCardHTML(item, departmentMap[item.departmentId])).join('')}</div>
        </div>`).join('')
    }
  `;
}

function catalogCardHTML(item, department) {
  const icons = {
    Designing: '🎨',
    Consultation: '🤝',
    'Business Services': '🏢',
    Packages: '📚',
    'Add-ons': '➕',
    'Custom Projects': '🛠',
    Merchandise: '🛍',
    Other: '📦'
  };

  const icon = icons[item.category] || '📦';

  return `
    <div class="catalog-card" id="catalog-${item.id}" onclick="openCatalogModal(${item.id})">
      <div class="catalog-icon">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="catalog-name">${item.name}</div>
        ${item.description ? `<div class="catalog-category">${item.description}</div>` : ''}
        <div class="catalog-category mt-4">
          ${item.category}${item.unit ? ` · per ${item.unit}` : ''}${department?.name ? ` · ${department.name}` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="catalog-price">MWK ${Number(item.price || 0).toLocaleString()}</div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteCatalogItem(${item.id})">🗑</button>
      </div>
    </div>`;
}

async function openCatalogModal(itemId = null) {
  const isEdit = !!itemId;
  const [departments, item] = await Promise.all([
    window.KwezaDB.getAllDepartments(),
    isEdit ? window.KwezaDB.db.catalog.get(itemId) : Promise.resolve(null)
  ]);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Item' : 'Add Catalog Item'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Service / Product Name <span>*</span></label>
          <input class="form-control" id="ci-name" placeholder="e.g. Website Design" value="${item?.name || ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Price (MWK) <span>*</span></label>
            <input class="form-control" id="ci-price" type="number" min="0" placeholder="150000" value="${item?.price || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Unit</label>
            <input class="form-control" id="ci-unit" placeholder="project / hour / month" value="${item?.unit || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-control" id="ci-category">
              ${CATALOG_CATEGORIES.map(category => `<option value="${category}" ${item?.category === category ? 'selected' : ''}>${category}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Owning Department</label>
            <select class="form-control" id="ci-department">
              <option value="">Shared / Unassigned</option>
              ${departments.map(department => `<option value="${department.id}" ${item?.departmentId === department.id ? 'selected' : ''}>${department.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="ci-desc" rows="2" placeholder="Brief description">${item?.description || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCatalogItem(${itemId || 'null'})">
          ${isEdit ? 'Save Changes' : '+ Add Item'}
        </button>
      </div>
    </div>`;

  modal.classList.add('active');
}

async function saveCatalogItem(itemId = null) {
  const name = document.getElementById('ci-name').value.trim();
  const price = parseFloat(document.getElementById('ci-price').value);
  if (!name || Number.isNaN(price)) {
    showToast('Name and price are required', 'error');
    return;
  }

  const data = {
    name,
    price,
    unit: document.getElementById('ci-unit').value.trim(),
    category: document.getElementById('ci-category').value,
    departmentId: document.getElementById('ci-department').value || null,
    description: document.getElementById('ci-desc').value.trim()
  };

  const { db } = window.KwezaDB;
  if (itemId) {
    await db.catalog.update(itemId, data);
    showToast('Item updated!', 'success');
  } else {
    await db.catalog.add(data);
    showToast('Item added to catalog!', 'success');
  }

  closeModal();
  await renderCatalog();
}

async function deleteCatalogItem(id) {
  if (!confirm('Remove this item from the catalog?')) return;
  await window.KwezaDB.db.catalog.delete(id);
  showToast('Item removed', 'info');
  await renderCatalog();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, {
  renderCatalog,
  openCatalogModal,
  saveCatalogItem,
  deleteCatalogItem
});
