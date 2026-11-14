import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { City } from '@/shared/api/cities-contract';
import { Banner, Button, Dialog, Input } from '@/shared/ui';

import type { EnableResult } from '../hooks/usePushReminder';
import { DEFAULT_REMINDER_TIME, ReminderTimeSchema } from '../lib/reminderTime';

const FormSchema = z.object({ reminderTime: ReminderTimeSchema });
type FormValues = z.input<typeof FormSchema>;

export interface ReminderDialogProps {
  open: boolean;
  city: City;
  initialTime?: string;
  onClose: () => void;
  /** Runs the permission prompt + subscription. Only called after the user confirms. */
  onConfirm: (reminderTime: string) => Promise<EnableResult>;
}

/**
 * The explainer shown *before* the browser's permission prompt: what arrives, when, and how
 * to stop it. The prompt itself only appears after "Turn on reminders".
 */
export function ReminderDialog({
  open,
  city,
  initialTime,
  onClose,
  onConfirm,
}: ReminderDialogProps) {
  const formId = useId();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onTouched', // validated on blur, then as you fix it
    defaultValues: { reminderTime: initialTime ?? DEFAULT_REMINDER_TIME },
  });

  const submit = handleSubmit(async ({ reminderTime }) => {
    setFailure(null);
    const result = await onConfirm(reminderTime);
    if (result.ok || result.reason === 'denied') {
      onClose(); // the card explains "denied" in place
    } else if (result.reason === 'dismissed') {
      setFailure('The permission prompt was dismissed. Turn on reminders again when you’re ready.');
    } else {
      setFailure(result.message ?? 'Couldn’t set up the reminder. Please try again.');
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Daily forecast for ${city.name}?`}
      description="Get one short notification a day with today’s weather."
      actions={
        <>
          <Button onClick={onClose}>Not now</Button>
          <Button type="submit" form={formId} variant="primary" loading={isSubmitting}>
            Turn on reminders
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="font-medium text-fg">What you get</dt>
            <dd className="text-fg-muted">
              Today’s high and low and the chance of rain for {city.name}.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">When</dt>
            <dd className="text-fg-muted">
              Once a day, at the time you pick below (your local time).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Turning it off</dt>
            <dd className="text-fg-muted">
              Any time, from this card — or in your browser’s site settings.
            </dd>
          </div>
        </dl>

        <Input
          {...register('reminderTime')}
          type="time"
          step={300}
          label="Reminder time"
          hint="In 5-minute steps, for example 07:30."
          {...(errors.reminderTime?.message ? { error: errors.reminderTime.message } : {})}
        />

        <p className="text-xs text-fg-muted">
          Your browser will ask for permission to show notifications next.
        </p>

        {failure && (
          <Banner tone="error" title="Reminder not set up">
            {failure}
          </Banner>
        )}
      </form>
    </Dialog>
  );
}
