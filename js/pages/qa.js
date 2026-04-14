/* ============================================
   KWEZA - QA REVIEWS PAGE
   Quality Assurance — approve / reject project delivery
   Only accessible to admin, administration role
   ============================================ */

async function renderQA() {
  const { db } = window.KwezaDB;
  const user   = window.KwezaAuth.getCurrentUser();

  // Permission guard — QA is for admin + administration + qa role
  if (!window.KwezaAuth.hasRole('admin', 'administration')) {
    document.getElementById('qa-page').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3>Access Restricted</h3>
        <p>QA Reviews are managed by the Administration department.</p>
      </div>`;
    return;
  }

  const [qaReviews, projects, departments] = await Promise.all([
    db.qaReviews.orderBy('id').reverse().toArray(),
    db.projects.toArray(),
    db.departments.toArray()
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const deptMap    = Object.fromEntries(departments.map(d => [d.id, d]));

  // Projects awaiting QA (status = 'QA' with no passing review yet)
  const pendingQAProjects = projects.filter(p => p.status === 'QA' || p.status === 'Revision');
  const passCount  = qaReviews.filter(r => r.result === 'pass').length;
  const failCount  = qaReviews.filter(r => r.result === 'fail').length;
  const condCount  = qaReviews.filter(r => r.result === 'conditional').length;

  document.getElementById('qa-page').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>QA Reviews</h2>
        <p>Quality assurance gate — approve or reject project delivery</p>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-value">${qaReviews.length}</div>
        <div class="stat-label">Total Reviews</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E65100">${pendingQAProjects.length}</div>
        <div class="stat-label">Awaiting QA</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#2E7D32">${passCount}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#C62828">${failCount}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#E65100">${condCount}</div>
        <div class="stat-label">Conditional</div>
      </div>
    </div>

    ${pendingQAProjects.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">🔔 Projects Awaiting QA Review</h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${pendingQAProjects.map(p => qaProjectCardHTML(p, deptMap[p.departmentId])).join('')}
      </div>
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin-bottom:24px;" />
    ` : ''}

    <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">QA Review History</h3>
    ${qaReviews.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No reviews yet</h3><p>QA reviews will appear here once submitted from the Project detail view.</p></div>`
      : `<div style="display:flex;flex-direction:column;gap:10px;">${qaReviews.map(r => qaReviewRow(r, projectMap[r.projectId], deptMap)).join('')}</div>`}
  `;
}
window.renderQA = renderQA;

function qaProjectCardHTML(project, dept) {
  const color = project.status === 'Revision' ? '#C62828' : '#6A1B9A';
  return `
    <div class="doc-card" style="border-left:4px solid ${color};">
      <div class="doc-card-icon" style="background:${color}20;color:${color};font-size:20px;">🔍</div>
      <div class="doc-card-info">
        <div class="doc-number">${project.projectCode} · <strong>${project.name}</strong></div>
        <div class="doc-client">${dept?.name || project.departmentId || '—'}</div>
        <div class="doc-date">Created: ${new Date(project.createdAt).toLocaleDateString('en-GB')}</div>
      </div>
      <div class="doc-card-right">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${project.status}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="navigate('projects/${project.id}')">View Project</button>
          <button class="btn btn-primary btn-sm" onclick="quickQAReview(${project.id})">Review Now</button>
        </div>
      </div>
    </div>
  `;
}

function qaReviewRow(review, project, deptMap) {
  const color  = review.result === 'pass' ? '#2E7D32' : review.result === 'fail' ? '#C62828' : '#E65100';
  const icon   = review.result === 'pass' ? '✅' : review.result === 'fail' ? '❌' : '⚠️';
  const checkItems = review.checklist ? Object.entries(review.checklist) : [];

  return `
    <div class="doc-card">
      <div class="doc-card-icon" style="font-size:22px;">${icon}</div>
      <div class="doc-card-info">
        <div class="doc-number">
          ${project ? `<a href="#" onclick="navigate('projects/${project.id}');return false;" style="color:var(--primary);">${project.projectCode || '—'} · ${project.name}</a>` : 'Unknown project'}
        </div>
        <div class="doc-client">Reviewed by: ${review.reviewerDept || '—'} · ${review.reviewerId}</div>
        <div class="doc-date">${new Date(review.createdAt).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</div>
        ${review.notes ? `<div class="doc-prepared" style="font-style:italic;">"${review.notes}"</div>` : ''}
        ${checkItems.length > 0 ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
          ${checkItems.map(([k, v]) => `<span style="font-size:11px;color:${v ? '#2E7D32' : '#E53935'};">${v ? '✓' : '✗'} ${k.replace(/_/g, ' ')}</span>`).join('')}
        </div>` : ''}
      </div>
      <div class="doc-card-right" style="flex-direction:column;align-items:flex-end;gap:6px;">
        <span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40;font-weight:700;">${review.result.toUpperCase()}</span>
        ${review.score ? `<span style="font-size:12px;color:var(--text-secondary);">Score: ${review.score}/10</span>` : ''}
      </div>
    </div>
  `;
}

/* ─── QUICK QA REVIEW MODAL (from QA page) ───────────────────── */
async function quickQAReview(projectId) {
  const project = await window.KwezaDB.db.projects.get(projectId);
  if (!project) return;

  const check = await window.KwezaDB.canCompleteProject(projectId);

  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <div class="modal-header">
        <h3>QA Review — ${project.name}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <!-- Readiness Summary -->
        <div style="background:var(--surface);border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:8px;">Project Readiness</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
            <div style="color:${check.allTasksDone ? '#2E7D32' : '#E53935'};">${check.allTasksDone ? '✓' : '✗'} All tasks done (${check.doneCount}/${check.taskCount})</div>
            <div style="color:${check.hasCompletionReport ? '#2E7D32' : '#E53935'};">${check.hasCompletionReport ? '✓' : '✗'} Completion report submitted</div>
            <div style="color:${check.qaApproved ? '#2E7D32' : '#E65100'};">${check.qaApproved ? '✓' : '⏳'} Previous QA: ${check.qaApproved ? 'Approved' : 'Pending'}</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Result <span>*</span></label>
          <div style="display:flex;gap:12px;">
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qqa-result" value="pass"> ✅ Pass</label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qqa-result" value="conditional"> ⚠️ Conditional</label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;"><input type="radio" name="qqa-result" value="fail"> ❌ Fail</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Score (1–10, optional)</label>
          <input class="form-control" id="qqa-score" type="number" min="1" max="10" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes / Feedback</label>
          <textarea class="form-control" id="qqa-notes" rows="3" placeholder="Approval comments, issues, or required revisions..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600;">Checklist</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qqa-docs" ${check.hasCompletionReport ? 'checked' : ''}> Documentation / reports complete</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qqa-client"> Client review confirmed</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qqa-delivery"> Delivery confirmed</label>
            <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="qqa-tasks" ${check.allTasksDone ? 'checked' : ''}> All tasks marked done</label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="submitQuickQA(${projectId}, 'fail')" style="background:#C62828;">❌ Fail</button>
        <button class="btn btn-primary" onclick="submitQuickQA(${projectId})" style="background:#2E7D32;">✅ Submit Review</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
}
window.quickQAReview = quickQAReview;

async function submitQuickQA(projectId, forceResult = null) {
  const result = forceResult || document.querySelector('input[name="qqa-result"]:checked')?.value;
  if (!result) { showToast('Select a result first.', 'error'); return; }

  const checklist = {
    docs_complete:      document.getElementById('qqa-docs')?.checked     || false,
    client_review:      document.getElementById('qqa-client')?.checked   || false,
    delivery_confirmed: document.getElementById('qqa-delivery')?.checked || false,
    tasks_done:         document.getElementById('qqa-tasks')?.checked    || false
  };

  await window.KwezaDB.submitQAReview({
    projectId,
    result,
    score:    parseInt(document.getElementById('qqa-score')?.value, 10) || null,
    notes:    document.getElementById('qqa-notes')?.value?.trim() || '',
    checklist
  });

  const label = { pass:'PASSED ✅', fail:'FAILED ❌', conditional:'CONDITIONAL ⚠️' }[result];
  showToast(`QA Review submitted — ${label}`, result === 'pass' ? 'success' : result === 'fail' ? 'error' : 'warning');
  closeModal();
  await renderQA();
  await window.KwezaApp.updateNavBadges();
}
window.submitQuickQA = submitQuickQA;

/* ─── REGISTER ────────────────────────────────────────────────── */
window.KwezaPages = window.KwezaPages || {};
Object.assign(window.KwezaPages, { renderQA, quickQAReview, submitQuickQA });
