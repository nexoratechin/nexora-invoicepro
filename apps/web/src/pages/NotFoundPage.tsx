import { Link } from 'react-router-dom';

import { BrandMark } from '../components/BrandMark';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-mist px-6 text-center">
      <BrandMark className="h-10 w-10" />
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-brand-blue">
        404 · Not found
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">That page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        The link may be old, or the record may have been deleted.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-dark"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
