// Browser-console script the user pastes into a logged-in LeetCode tab during
// Advanced Import. It reads the submission list locally and copies an import
// JSON to the clipboard — it never transmits cookies or credentials.
export const CONSOLE_SCRIPT = `(async () => {
  console.log('LeetTracker: Fetching solved and attempted problems...');

  const apiResp = await fetch('/api/problems/all/', {
    headers: { 'Content-Type': 'application/json' }
  });
  const apiJson = await apiResp.json();

  if (!apiJson.stat_status_pairs) {
    console.error('LeetTracker: Failed to fetch problems. Are you logged in?');
    return;
  }

  const allSlugs = new Set(
    apiJson.stat_status_pairs
      .filter(p => p.status === 'ac')
      .map(p => p.stat.question__title_slug)
  );
  console.log(\`LeetTracker: Found \${allSlugs.size} solved problems.\`);

  const subQuery = \`query submissionList($offset: Int!, $limit: Int!) {
    submissionList(offset: $offset, limit: $limit) {
      hasNext submissions { titleSlug statusDisplay timestamp }
    }
  }\`;

  const solvedDateMap = {};
  const attemptedDateMap = {};
  let offset = 0, hasNext = true, page = 1;

  while (hasNext) {
    console.log(\`LeetTracker: Fetching dates page \${page}...\`);
    const resp = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: subQuery, variables: { offset, limit: 50 } })
    });
    const json = await resp.json();
    const list = json?.data?.submissionList;
    if (!list) break;

    for (const sub of list.submissions) {
      if (!sub?.titleSlug) continue;

      if (sub.statusDisplay === 'Accepted') {
        if (!solvedDateMap[sub.titleSlug]) {
          solvedDateMap[sub.titleSlug] = sub.timestamp;
        }
      } else if (!attemptedDateMap[sub.titleSlug]) {
        attemptedDateMap[sub.titleSlug] = sub.timestamp;
      }
    }

    hasNext = list.hasNext;
    offset += 50;
    page++;
    if (hasNext) await new Promise(r => setTimeout(r, 400));
  }

  const fallbackTs = Math.floor(Date.now() / 1000).toString();
  const solvedMap = {};
  for (const slug of allSlugs)
    solvedMap[slug] = solvedDateMap[slug] || fallbackTs;

  const attemptedMap = {};
  for (const [slug, timestamp] of Object.entries(attemptedDateMap))
    if (!allSlugs.has(slug))
      attemptedMap[slug] = timestamp || fallbackTs;

  const withDates = Object.values(solvedMap).filter(t => t !== fallbackTs).length;
  console.log(\`LeetTracker: \${withDates}/\${allSlugs.size} have exact dates. Rest use today as fallback.\`);
  console.log(\`LeetTracker: Found \${Object.keys(attemptedMap).length} attempted-only problems.\`);

  const importPayload = {
    solvedMap,
    attemptedMap
  };

  // Prepare final JSON (pretty)
  const finalJson = JSON.stringify(importPayload, null, 2);

  // 1) Try modern clipboard API
  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(finalJson);
      console.log('LeetTracker: Successfully copied JSON to clipboard (navigator.clipboard).');
      copied = true;
    } catch (err) {
      console.warn('LeetTracker: navigator.clipboard failed:', err);
      copied = false;
    }
  }

  // 2) Fallback to document.execCommand copy attempt
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = finalJson;
      // keep off-screen
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        console.log('LeetTracker: Successfully copied JSON to clipboard (execCommand).');
        copied = true;
      } else {
        console.warn('LeetTracker: execCommand copy returned false.');
      }
    } catch (err) {
      console.warn('LeetTracker: execCommand copy failed:', err);
    }
  }

  // 3) ALWAYS print to console for visibility
  console.log('LeetTracker: Final import JSON (copy manually if needed):');
  console.log(finalJson);

  // 4) Create visible panel with textarea + buttons so user can manually copy/select
  (function createCopyPanel() {
    // Avoid creating multiple panels if script run multiple times
    if (document.getElementById('leettracker-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'leettracker-panel';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.width = '420px';
    panel.style.maxWidth = 'calc(100% - 24px)';
    panel.style.zIndex = 999999;
    panel.style.background = 'white';
    panel.style.border = '1px solid rgba(0,0,0,0.12)';
    panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    panel.style.borderRadius = '8px';
    panel.style.padding = '10px';
    panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    panel.style.fontSize = '12px';
    panel.style.color = '#111';

    const title = document.createElement('div');
    title.textContent = 'LeetTracker — import JSON';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    panel.appendChild(title);

    const ta = document.createElement('textarea');
    ta.value = finalJson;
    ta.readOnly = true;
    ta.style.width = '100%';
    ta.style.height = '200px';
    ta.style.resize = 'vertical';
    ta.style.fontFamily = 'monospace';
    ta.style.fontSize = '11px';
    ta.style.lineHeight = '1.2';
    ta.style.padding = '8px';
    ta.style.boxSizing = 'border-box';
    panel.appendChild(ta);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '8px';
    btnRow.style.justifyContent = 'flex-end';

    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Select all';
    selectBtn.onclick = () => {
      ta.focus();
      ta.select();
    };
    selectBtn.style.cursor = 'pointer';
    selectBtn.style.padding = '6px 8px';
    selectBtn.style.borderRadius = '6px';
    selectBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    selectBtn.style.background = '#fff';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = copied ? 'Copied' : 'Copy to clipboard';
    copyBtn.style.cursor = 'pointer';
    copyBtn.style.padding = '6px 8px';
    copyBtn.style.borderRadius = '6px';
    copyBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    copyBtn.style.background = copied ? '#e6ffe6' : '#fff';
    copyBtn.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(ta.value);
        } else {
          ta.select();
          document.execCommand('copy');
        }
        copyBtn.textContent = 'Copied';
        copyBtn.style.background = '#e6ffe6';
        console.log('LeetTracker: User clicked copy — successful.');
      } catch (err) {
        console.error('LeetTracker: User clicked copy — failed:', err);
        copyBtn.textContent = 'Copy failed — select manually';
        copyBtn.style.background = '#ffe6e6';
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '6px 8px';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    closeBtn.style.background = '#fff';
    closeBtn.onclick = () => panel.remove();

    btnRow.appendChild(selectBtn);
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(btnRow);

    document.body.appendChild(panel);
  })();

})();`;
