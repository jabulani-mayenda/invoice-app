/* ============================================
   KWEZA – SETTINGS PAGE
   ============================================ */
async function renderSettings() {
  if (window.KwezaAuth && !window.KwezaAuth.isAdmin()) {
    document.getElementById('settings-page').innerHTML = `
      <div class="page-header"><h2>Settings</h2></div>
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3>Access Denied</h3>
        <p>Only the Administrator account can view or modify system settings.</p>
      </div>`;
    return;
  }

  const { getAllSettings } = window.KwezaDB;
  const settings = await getAllSettings();
  const c = settings.company;
  const b = settings.branding;
  const d = settings.defaults;

  document.getElementById('settings-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left"><h2>Settings</h2><p>Configure your business profile</p></div>
      <button class="btn btn-primary" onclick="saveAllSettings()">💾 Save Settings</button>
    </div>

    <!-- Branding -->
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="section-icon">🎨</div>
        <div><h3>Branding & Logo</h3><div class="card-subtitle">Your logo appears on all PDFs</div></div>
      </div>
      <div class="settings-body">
        <div class="flex gap-20" style="align-items:flex-start;flex-wrap:wrap;">
          <div style="flex:1;">
            <div class="logo-upload-area" onclick="document.getElementById('logo-file-input').click()">
              ${b.logo ? `<img src="${b.logo}" class="logo-preview" id="logo-preview-img" style="max-height:80px;"/>` : `<div style="font-size:48px;">🏢</div>`}
              <div class="text-muted text-sm" id="logo-upload-text">Click to upload Logo</div>
            </div>
            <input type="file" id="logo-file-input" accept="image/*" style="display:none" onchange="handleLogoUpload(this, 'logo')" />
            
            <div class="logo-upload-area mt-12" onclick="document.getElementById('sig-file-input').click()" style="margin-top:16px;">
              ${b.signature ? `<img src="${b.signature}" class="logo-preview" id="sig-preview-img" style="max-height:60px;"/>` : `<div style="font-size:32px;">✍️</div>`}
              <div class="text-muted text-sm" id="sig-upload-text">Click to upload HR Signature</div>
            </div>
            <input type="file" id="sig-file-input" accept="image/*" style="display:none" onchange="handleLogoUpload(this, 'signature')" />
          </div>
          <div style="flex:1;min-width:200px;">
            <div class="form-group">
              <label class="form-label">Invoice Number Prefix</label>
              <input class="form-control" id="s-inv-prefix" value="${b.invoicePrefix||'KFS'}" placeholder="KFS" />
              <div class="form-hint">e.g. KFS → KFS-001</div>
            </div>
            <div class="form-group mt-12" style="margin-top:12px;">
              <label class="form-label">Quotation Number Prefix</label>
              <input class="form-control" id="s-quote-prefix" value="${b.quotePrefix||'KFS-Q'}" placeholder="KFS-Q" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Company Info -->
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="section-icon">🏢</div>
        <div><h3>Company Information</h3><div class="card-subtitle">Appears on all documents</div></div>
      </div>
      <div class="settings-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Company Name <span>*</span></label>
            <input class="form-control" id="s-co-name" value="${c.name||''}" placeholder="Kweza Financial Solutions Ltd" />
          </div>
          <div class="form-group">
            <label class="form-label">Tagline / Division</label>
            <input class="form-control" id="s-co-tagline" value="${c.tagline||''}" placeholder="e.g. Kweza Developers" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="s-co-email" type="email" value="${c.email||''}" placeholder="email@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Primary Phone</label>
            <input class="form-control" id="s-co-phone" value="${c.phone||''}" placeholder="+265 (0) 983501964" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Secondary Phone</label>
            <input class="form-control" id="s-co-phone2" value="${c.phone2||''}" placeholder="+265 (0) 893624209" />
          </div>
          <div class="form-group">
            <label class="form-label">Website</label>
            <input class="form-control" id="s-co-website" value="${c.website||''}" placeholder="www.kwezafinancial.com" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="s-co-address" rows="2" placeholder="Area 47, Lilongwe, Malawi">${c.address||''}</textarea>
        </div>
      </div>
    </div>

    <!-- Invoice Defaults -->
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="section-icon">⚙️</div>
        <div><h3>Invoice Defaults</h3><div class="card-subtitle">Applied to new documents automatically</div></div>
      </div>
      <div class="settings-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Default Currency</label>
            <select class="form-control" id="s-currency">
              <option value="MWK" ${d.currency==='MWK'?'selected':''}>MWK – Malawian Kwacha</option>
              <option value="USD" ${d.currency==='USD'?'selected':''}>USD – US Dollar</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Default VAT Rate (%)</label>
            <input class="form-control" id="s-vat" type="number" min="0" value="${d.vatRate??16.5}" />
            <div class="form-hint">Malawi standard VAT is 16.5%</div>
          </div>
          <div class="form-group">
            <label class="form-label">Quote Validity (days)</label>
            <input class="form-control" id="s-validity" type="number" min="1" value="${d.validityDays||14}" />
          </div>
        </div>
        <div class="form-group mt-12" style="margin-top:12px;">
          <label class="form-label">Default Invoice Notes</label>
          <textarea class="form-control" id="s-inv-notes" rows="2" placeholder="Thank you for your business!">${d.invoiceNotes||''}</textarea>
        </div>
      </div>
    </div>

    <!-- Bank Details -->
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="section-icon">🏦</div>
        <div><h3>Banking Details</h3><div class="card-subtitle">Shown on invoices for payment reference</div></div>
      </div>
      <div class="settings-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input class="form-control" id="s-bank-name" value="${d.bankName||''}" placeholder="National Bank of Malawi" />
          </div>
          <div class="form-group">
            <label class="form-label">Account Number</label>
            <input class="form-control" id="s-bank-acc" value="${d.bankAccount||''}" placeholder="1234567890" />
          </div>
          <div class="form-group">
            <label class="form-label">Branch</label>
            <input class="form-control" id="s-bank-branch" value="${d.bankBranch||''}" placeholder="Lilongwe Branch" />
          </div>
        </div>
      </div>
    </div>

    <!-- PWA Install -->
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="section-icon">📱</div>
        <div><h3>Install App</h3><div class="card-subtitle">Install on your device for offline use</div></div>
      </div>
      <div class="settings-body">
        <p class="text-muted text-sm" style="margin-bottom:16px;">Install Kweza Invoice on your phone or computer to use it offline — no internet needed!</p>
        <button class="btn btn-primary" id="pwa-install-btn" onclick="triggerPWAInstall()" style="display:none">📱 Install App</button>
        <div id="pwa-installed-msg" class="badge badge-success" style="display:none;">✅ App is installed!</div>
        <div class="text-muted text-sm mt-8" style="margin-top:8px;">On Android Chrome: Menu → "Add to Home Screen"</div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="settings-section" style="border-color:rgba(211,47,47,0.2);">
      <div class="settings-section-header">
        <div class="section-icon" style="background:var(--danger-bg);">⚠️</div>
        <div><h3>Danger Zone</h3><div class="card-subtitle">Irreversible actions</div></div>
      </div>
      <div class="settings-body">
        <button class="btn btn-danger btn-sm" onclick="exportAllData()">📤 Export All Data (JSON)</button>
        <button class="btn btn-danger btn-sm" style="margin-left:10px;" onclick="clearAllData()">🗑 Clear All Data</button>
      </div>
    </div>
  `;

  // Show PWA install prompt if available
  if (window._pwaInstallEvent) {
    document.getElementById('pwa-install-btn').style.display = 'inline-flex';
  }
}

function handleLogoUpload(input, type = 'logo') {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    
    if (type === 'logo') {
      let img = document.getElementById('logo-preview-img');
      if (img) { img.src = dataUrl; }
      else { 
         document.getElementById('logo-file-input').previousElementSibling.innerHTML = `<img src="${dataUrl}" class="logo-preview" id="logo-preview-img" style="max-height:80px;"/><div class="text-muted text-sm">Click to change</div>`; 
      }
      window._pendingLogo = dataUrl;
    } else if (type === 'signature') {
      let img = document.getElementById('sig-preview-img');
      if (img) { img.src = dataUrl; }
      else { 
         document.getElementById('sig-file-input').previousElementSibling.innerHTML = `<img src="${dataUrl}" class="logo-preview" id="sig-preview-img" style="max-height:60px;"/><div class="text-muted text-sm">Click to change</div>`; 
      }
      window._pendingSignature = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

async function saveAllSettings() {
  const { setSetting, getAllSettings } = window.KwezaDB;
  const existing = await getAllSettings();
  const newBranding = {
    ...existing.branding,
    logo:          window._pendingLogo || existing.branding.logo,
    signature:     window._pendingSignature || existing.branding.signature,
    invoicePrefix: document.getElementById('s-inv-prefix')?.value || 'KFS',
    quotePrefix:   document.getElementById('s-quote-prefix')?.value || 'KFS-Q',
  };
  const newCompany = {
    name:    document.getElementById('s-co-name')?.value || '',
    tagline: document.getElementById('s-co-tagline')?.value || '',
    email:   document.getElementById('s-co-email')?.value || '',
    phone:   document.getElementById('s-co-phone')?.value || '',
    phone2:  document.getElementById('s-co-phone2')?.value || '',
    website: document.getElementById('s-co-website')?.value || '',
    address: document.getElementById('s-co-address')?.value || '',
  };
  const newDefaults = {
    currency:      document.getElementById('s-currency')?.value || 'MWK',
    vatRate:       parseFloat(document.getElementById('s-vat')?.value) || 16.5,
    validityDays:  parseInt(document.getElementById('s-validity')?.value) || 14,
    invoiceNotes:  document.getElementById('s-inv-notes')?.value || '',
    bankName:      document.getElementById('s-bank-name')?.value || '',
    bankAccount:   document.getElementById('s-bank-acc')?.value || '',
    bankBranch:    document.getElementById('s-bank-branch')?.value || '',
  };
  await Promise.all([
    setSetting('company', newCompany),
    setSetting('branding', newBranding),
    setSetting('defaults', newDefaults)
  ]);
  delete window._pendingLogo;
  // Update sidebar logo
  const sidebarLogo = document.getElementById('sidebar-logo-img');
  if (sidebarLogo && newBranding.logo) sidebarLogo.src = newBranding.logo;
  showToast('Settings saved!', 'success');
}

function triggerPWAInstall() {
  if (window._pwaInstallEvent) {
    window._pwaInstallEvent.prompt();
    window._pwaInstallEvent.userChoice.then(result => {
      if (result.outcome === 'accepted') {
        showToast('App installed! 🎉', 'success');
        document.getElementById('pwa-install-btn').style.display = 'none';
        document.getElementById('pwa-installed-msg').style.display = 'inline-flex';
      }
      window._pwaInstallEvent = null;
    });
  }
}

async function exportAllData() {
  const { db } = window.KwezaDB;
  const data = {
    exportedAt: new Date().toISOString(),
    clients:     await db.clients.toArray(),
    catalog:     await db.catalog.toArray(),
    quotations:  await db.quotations.toArray(),
    invoices:    await db.invoices.toArray(),
    lineItems:   await db.lineItems.toArray(),
    payments:    await db.payments.toArray(),
    loans:       await db.loans.toArray(),
    installments:await db.installments.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kweza-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('Data exported!', 'success');
}

async function clearAllData() {
  if (!confirm('⚠️ This will delete ALL data permanently. Are you sure?')) return;
  if (!confirm('Last chance! This cannot be undone. Delete everything?')) return;
  const { db } = window.KwezaDB;
  await Promise.all([
    db.clients.clear(), db.catalog.clear(), db.quotations.clear(),
    db.invoices.clear(), db.lineItems.clear(), db.payments.clear(),
    db.loans.clear(), db.installments.clear(), db.activity.clear()
  ]);
  showToast('All data cleared.', 'info');
  navigate('dashboard');
}

window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderSettings, handleLogoUpload, saveAllSettings, triggerPWAInstall, exportAllData, clearAllData });
