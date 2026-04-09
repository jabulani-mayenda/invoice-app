/* ============================================
   KWEZA – CATALOG PAGE
   ============================================ */
const CATALOG_CATEGORIES = ['Design','Development','Consultancy','Loans','Marketing','Legal','Other'];

async function renderCatalog() {
  const { db } = window.KwezaDB;
  const items = await db.catalog.orderBy('category').toArray();
  const grouped = {};
  items.forEach(i => { (grouped[i.category] = grouped[i.category] || []).push(i); });

  const page = document.getElementById('catalog-page');
  page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Product & Service Catalog</h2>
        <p>${items.length} item${items.length !== 1 ? 's' : ''} saved — tap to use in a quote</p>
      </div>
      <button class="btn btn-primary" onclick="openCatalogModal()">+ Add Item</button>
    </div>

    ${items.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Catalog is empty</h3><p>Save your services here for one-tap use in quotations</p>
         <button class="btn btn-primary mt-12" onclick="openCatalogModal()">+ Add Your First Service</button></div>`
      : Object.entries(grouped).map(([cat, catItems]) => `
        <div class="mb-20">
          <div class="text-muted text-sm font-semibold" style="text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">${cat}</div>
          <div class="grid grid-3">${catItems.map(catalogCardHTML).join('')}</div>
        </div>`).join('')
    }
  `;
}

function catalogCardHTML(item) {
  const icons = { Design:'🎨', Development:'💻', Consultancy:'🤝', Loans:'💰', Marketing:'📢', Legal:'⚖️', Other:'📦' };
  const icon = icons[item.category] || '📦';
  return `
    <div class="catalog-card" id="catalog-${item.id}" onclick="openCatalogModal(${item.id})">
      <div class="catalog-icon">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="catalog-name">${item.name}</div>
        ${item.description ? `<div class="catalog-category">${item.description}</div>` : ''}
        <div class="catalog-category mt-4">${item.category} ${item.unit ? '· per ' + item.unit : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="catalog-price">MWK ${Number(item.price).toLocaleString()}</div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteCatalogItem(${item.id})">🗑</button>
      </div>
    </div>`;
}

function openCatalogModal(itemId = null) {
  const isEdit = !!itemId;
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3>${isEdit ? '✏️ Edit Item' : '📦 Add Catalog Item'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Service / Product Name <span>*</span></label>
          <input class="form-control" id="ci-name" placeholder="e.g. Website Design" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Price (MWK) <span>*</span></label>
            <input class="form-control" id="ci-price" type="number" min="0" placeholder="150000" />
          </div>
          <div class="form-group">
            <label class="form-label">Unit</label>
            <input class="form-control" id="ci-unit" placeholder="project / hour / month" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="ci-category">
            ${CATALOG_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="ci-desc" rows="2" placeholder="Brief description…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCatalogItem(${itemId})">
          ${isEdit ? 'Save Changes' : '+ Add Item'}
        </button>
      </div>
    </div>`;
  modal.classList.add('active');

  if (isEdit) {
    window.KwezaDB.db.catalog.get(itemId).then(item => {
      if (!item) return;
      document.getElementById('ci-name').value     = item.name || '';
      document.getElementById('ci-price').value    = item.price || '';
      document.getElementById('ci-unit').value     = item.unit || '';
      document.getElementById('ci-category').value = item.category || 'Other';
      document.getElementById('ci-desc').value     = item.description || '';
    });
  }
}

async function saveCatalogItem(itemId) {
  const name  = document.getElementById('ci-name').value.trim();
  const price = parseFloat(document.getElementById('ci-price').value);
  if (!name || isNaN(price)) { showToast('Name and price are required', 'error'); return; }

  const data = {
    name, price,
    unit:        document.getElementById('ci-unit').value.trim(),
    category:    document.getElementById('ci-category').value,
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
  renderCatalog();
}

async function deleteCatalogItem(id) {
  if (!confirm('Remove this item from the catalog?')) return;
  await window.KwezaDB.db.catalog.delete(id);
  showToast('Item removed', 'info');
  renderCatalog();
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderCatalog, openCatalogModal, saveCatalogItem, deleteCatalogItem });
