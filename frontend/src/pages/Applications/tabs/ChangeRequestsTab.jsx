import ChangeRequestsCard from '../ChangeRequestsCard';

// Thin pass-through so ApplicationDetailPage.jsx's import doesn't need to change — the real
// implementation lives in ChangeRequestsCard.jsx, deliberately not built on SubResourceTab.jsx
// (Known Issues renders through that one; see the project report for why this module needed its
// own).
export default function ChangeRequestsTab({ applicationId }) {
  return <ChangeRequestsCard applicationId={applicationId} />;
}
