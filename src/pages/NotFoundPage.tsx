import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export function NotFoundPage() {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-accent-400 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-[17px] font-semibold text-ink-50 [html.light_&]:text-ink-900">Page not found</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-dimmer">
            That route does not exist in the CYBERSURE prototype. Use the navigation to return to the security overview.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary">
            <Link to="/assessment">Back to overview</Link>
          </Button>
          <Button variant="secondary">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
