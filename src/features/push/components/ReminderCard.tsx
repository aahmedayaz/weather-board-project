import { useState } from 'react';

import type { City } from '@/shared/api/cities-contract';
import { Banner, Button, Card } from '@/shared/ui';

import { usePushReminder } from '../hooks/usePushReminder';

import { ReminderDialog } from './ReminderDialog';

export interface ReminderCardProps {
  city: City;
  className?: string;
}

/** Daily forecast reminder: set up, change, turn off — or explain why it isn't available. */
export function ReminderCard({ city, className }: ReminderCardProps) {
  const { state, enable, disable } = usePushReminder();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (state.status === 'not-configured') return null; // this deployment has no push worker

  let body;
  switch (state.status) {
    case 'loading':
      body = <p className="text-sm text-fg-muted">Checking reminder settings…</p>;
      break;
    case 'ios-needs-install':
      body = (
        <Banner tone="info" title="Install WeatherBoard to get reminders">
          On iPhone and iPad, notifications only work in the installed app: tap Share, then “Add to
          Home Screen”, and open WeatherBoard from your Home Screen.
        </Banner>
      );
      break;
    case 'unsupported':
      body = (
        <Banner tone="info" title="This browser can’t send reminders">
          It doesn’t support {state.missing.join(', ')}. Everything else in WeatherBoard works; for
          reminders, try a current Chrome, Edge, Firefox or Safari.
        </Banner>
      );
      break;
    case 'denied':
      body = (
        <Banner tone="warning" title="Notifications are blocked for WeatherBoard">
          To turn them back on, open this site’s settings (the icon to the left of the address) →
          Notifications → Allow, then reload the page.
        </Banner>
      );
      break;
    case 'off':
      body = (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-fg-muted">
            Get a short morning summary for {city.name} at a time you choose.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Set up daily reminder
          </Button>
        </div>
      );
      break;
    case 'on':
      body = (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg">
            Daily reminder at{' '}
            <span className="numeric font-semibold">{state.settings.reminderTime}</span> for{' '}
            <span className="font-semibold">{state.settings.cityName}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              Change
            </Button>
            <Button
              variant="ghost"
              loading={busy}
              onClick={() => {
                setBusy(true);
                void disable().finally(() => {
                  setBusy(false);
                });
              }}
            >
              Turn off
            </Button>
          </div>
        </div>
      );
      break;
  }

  return (
    <Card title="Daily reminder" className={className}>
      {body}
      {dialogOpen && (
        <ReminderDialog
          open
          city={city}
          {...(state.status === 'on' ? { initialTime: state.settings.reminderTime } : {})}
          onClose={() => {
            setDialogOpen(false);
          }}
          onConfirm={(time) => enable(time, city)}
        />
      )}
    </Card>
  );
}
