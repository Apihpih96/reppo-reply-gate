const cases = [
  {
    id: 'delivery-status',
    title: 'Delivery status',
    category: 'SHIPPING',
    customerMessage: 'Could you promise this parcel will arrive tomorrow? Tracking only says “label created.”',
    evidence: [
      'Fictional carrier update: label created; no pickup scan yet.',
      'Support rule: never promise an arrival date without a carrier estimate.'
    ],
    sampleDraft: 'I can’t promise tomorrow yet. The latest update shows the label is created, but the carrier has not scanned the parcel. I’ll share the next update as soon as tracking changes.',
    mockOutcome: 'allow',
    critique: 'Grounded in the confirmed tracking status; avoids inventing an arrival date.'
  },
  {
    id: 'refund-status',
    title: 'Refund request',
    category: 'BILLING',
    customerMessage: 'Please confirm my refund has been approved and will arrive in two days.',
    evidence: [
      'Fictional case record: refund request received; approval status is still pending.',
      'Support rule: do not promise approval or settlement timing before confirmation.'
    ],
    sampleDraft: 'Your refund is approved and should arrive in two days.',
    mockOutcome: 'revise',
    critique: 'Remove the unconfirmed approval and timing. Acknowledge the request and explain that the status is still being reviewed.',
    saferDraft: 'We’ve received your refund request and are reviewing it. I’ll update you when we can confirm its status; I can’t promise a settlement date yet.'
  },
  {
    id: 'account-deletion',
    title: 'Account deletion',
    category: 'ACCOUNT SAFETY',
    customerMessage: 'Delete my account now; I can’t access the email on file.',
    evidence: [
      'Fictional case record: identity verification is incomplete.',
      'Support rule: account deletion requires verified ownership and an authorized review.'
    ],
    sampleDraft: 'Your account has been permanently deleted.',
    mockOutcome: 'hold',
    critique: 'Hold this for a person: ownership is unverified and deletion is consequential. Do not claim the action happened.'
  }
];

function evaluateReplyGateMock(caseId) {
  const ticket = cases.find((item) => item.id === caseId);
  if (!ticket) throw new Error('Unknown fictional case');
  return {
    outcome: ticket.mockOutcome,
    critique: ticket.critique,
    saferDraft: ticket.saferDraft || null,
    source: 'preset-local-mock'
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.REPLY_GATE_CASES = cases;
  globalThis.evaluateReplyGateMock = evaluateReplyGateMock;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cases, evaluateReplyGateMock };
}

if (typeof document !== 'undefined') {
  const list = document.getElementById('caseList');
  const panel = document.getElementById('casePanel');
  let selectedId = cases[0].id;
  let reviewedId = null;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function renderList() {
    list.replaceChildren();
    cases.forEach((ticket, index) => {
      const button = node('button', `case-link${ticket.id === selectedId ? ' is-selected' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(ticket.id === selectedId));
      const number = node('span', 'case-number', `0${index + 1}`);
      const label = node('span', 'case-link-copy');
      label.append(node('strong', '', ticket.title), node('small', '', ticket.category));
      button.append(number, label, node('span', 'chevron', '↗'));
      button.addEventListener('click', () => {
        selectedId = ticket.id;
        render();
      });
      list.append(button);
    });
  }

  function render() {
    const ticket = cases.find((item) => item.id === selectedId);
    renderList();
    panel.replaceChildren();

    const heading = node('div', 'case-heading');
    const category = node('p', 'eyebrow', ticket.category);
    const mock = node('span', 'mock-chip', 'PRESET MOCK');
    heading.append(category, mock);
    panel.append(heading, node('h2', '', ticket.title));

    const message = node('blockquote', 'customer-message', `“${ticket.customerMessage}”`);
    const msgLabel = node('p', 'section-label', 'CUSTOMER MESSAGE · FICTIONAL');
    panel.append(msgLabel, message);

    const evidenceHeader = node('p', 'section-label', 'CASE EVIDENCE & RULE');
    const evidenceList = node('ul', 'evidence-list');
    ticket.evidence.forEach((fact) => evidenceList.append(node('li', '', fact)));
    panel.append(evidenceHeader, evidenceList);

    const draftTitle = node('p', 'section-label', 'HAND-WRITTEN SAMPLE DRAFT · NOT AI-GENERATED');
    const draft = node('p', 'draft-copy', ticket.sampleDraft);
    panel.append(draftTitle, draft);

    const review = node('section', 'review-box');
    review.setAttribute('aria-live', 'polite');
    if (reviewedId === ticket.id) {
      const result = evaluateReplyGateMock(ticket.id);
      const outcomeLabel = result.outcome.toUpperCase();
      review.classList.add(`outcome-${result.outcome}`);
      review.append(node('div', 'review-topline', 'LOCAL PRESET ROUTING · NOT A REPPO RESPONSE'));
      review.append(node('div', 'outcome-word', outcomeLabel));
      review.append(node('p', 'review-copy', result.critique));
      if (result.saferDraft) {
        review.append(node('p', 'section-label suggested-label', 'SAFER SAMPLE WORDING'));
        review.append(node('p', 'suggested-draft', result.saferDraft));
      }
      review.append(node('p', 'never-sent', 'No reply is sent. This result is a fixed local example.'));
    } else {
      review.append(node('div', 'review-topline', 'REVIEW GATE'));
      review.append(node('p', 'review-placeholder', 'Run the local mock to reveal this case’s preset routing note.'));
    }

    const run = node('button', 'run-button', reviewedId === ticket.id ? 'Run mock again' : 'Run local mock review');
    run.type = 'button';
    run.addEventListener('click', () => {
      reviewedId = ticket.id;
      render();
    });
    review.append(run);
    panel.append(review);
  }

  render();
}
