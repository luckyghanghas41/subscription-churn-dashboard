'use strict';
const {periods, audit} = window.churnData;
const byId = id => document.getElementById(id);
const outcomes = ['Renewed', 'Cancelled', 'Unknown'];
const groups = ['Priority review', 'Review', 'Routine'];
const reportColumns = ['customer', 'month', 'plan', 'days', 'sessions', 'minutes',
    'tickets', 'unresolved', 'invoice', 'outcome', 'review', 'reasons'];
let matching = [];

function row(target, values) {
    const entry = target.insertRow();
    for (const value of values) entry.insertCell().textContent = value;
    return entry;
}
function average(records, field) {
    return records.length
        ? (records.reduce((sum, record) => sum + record[field], 0) / records.length).toFixed(1)
        : '—';
}
function percentage(numerator, denominator) {
    return denominator ? (100 * numerator / denominator).toFixed(1) + '%' : '—';
}
function render() {
    const filtered = periods.filter(p =>
        (!byId('plan').value || p.plan === byId('plan').value) &&
        (!byId('month').value || p.month === byId('month').value));
    const cohorts = Object.fromEntries(outcomes.map(outcome =>
        [outcome, filtered.filter(p => p.outcome === outcome)]));
    const known = cohorts.Renewed.length + cohorts.Cancelled.length;
    const cards = byId('cards');
    cards.replaceChildren();
    for (const [label, value] of [
        ['Customer-periods', filtered.length],
        ['Observed renewal rate', percentage(cohorts.Renewed.length, known)],
        ['Observed cancellations', cohorts.Cancelled.length],
        ['Unknown outcomes', cohorts.Unknown.length],
    ]) {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = label;
        const number = document.createElement('strong');
        number.textContent = value;
        card.append(number);
        cards.append(card);
    }
    const table = byId('cohorts');
    table.replaceChildren();
    for (const outcome of outcomes) {
        const records = cohorts[outcome];
        const entry = row(table, [outcome, records.length, average(records, 'days'),
            average(records, 'sessions'), average(records, 'minutes'), average(records, 'tickets'),
            percentage(records.filter(p => p.unresolved > 0).length, records.length)]);
        const cell = entry.cells[2];
        cell.className = outcome === 'Cancelled' ? 'bar cancel' : 'bar';
        if (records.length) {
            const bar = document.createElement('span');
            bar.style.width = 4 * Number(cell.textContent) + 'px';
            bar.setAttribute('aria-hidden', 'true');
            cell.append(bar);
        }
    }
    const query = byId('customer').value.trim().toUpperCase();
    matching = filtered.filter(p => (!byId('review').value || p.review === byId('review').value)
        && p.customer.includes(query));
    matching.sort((a, b) => groups.indexOf(a.review) - groups.indexOf(b.review)
        || b.month.localeCompare(a.month) || a.customer.localeCompare(b.customer));
    const reviews = byId('reviewRows');
    reviews.replaceChildren();
    for (const p of matching.slice(0, 50)) {
        row(reviews, [p.customer, p.month, p.plan, p.days, p.tickets, p.outcome,
            p.review, p.reasons.join(', ') || '—']);
    }
    byId('matches').textContent = matching.length > 50
        ? `Showing 50 of ${matching.length} matching periods. Download the CSV for all matching rows.`
        : `${matching.length} matching periods.`;
    byId('export').disabled = !matching.length;
}

for (const field of ['plan', 'month']) {
    for (const value of [...new Set(periods.map(p => p[field]))].sort()) {
        byId(field).add(new Option(value, value));
    }
}
for (const id of ['plan', 'month', 'review', 'customer']) byId(id).addEventListener('input', render);
byId('auditCount').textContent = `Reconciliation audit (${audit.length} issues)`;
for (const a of audit) row(byId('auditRows'), [a.source, a.line ?? '—', a.issue, JSON.stringify(a.record)]);
byId('export').addEventListener('click', () => {
    const csvCell = value => {
        const text = String(value);
        const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
        return '"' + safe.replaceAll('"', '""') + '"';
    };
    const rows = matching.map(p => reportColumns.map(key => csvCell(p[key])).join(','));
    const url = URL.createObjectURL(new Blob([[reportColumns.join(','), ...rows].join('\r\n')],
        {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer_review.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
