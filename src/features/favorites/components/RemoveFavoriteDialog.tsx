import type { City } from '@/shared/api/cities-contract';
import { Button, Dialog } from '@/shared/ui';

export interface RemoveFavoriteDialogProps {
  city: City | null;
  onCancel: () => void;
  onConfirm: (city: City) => void;
}

/** Confirmation before removing a favourite. Cancel is first, so it gets initial focus. */
export function RemoveFavoriteDialog({ city, onCancel, onConfirm }: RemoveFavoriteDialogProps) {
  return (
    <Dialog
      open={city !== null}
      onClose={onCancel}
      title={city ? `Remove ${city.name} from favourites?` : ''}
      description="You can add it again from its weather card at any time."
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (city) onConfirm(city);
            }}
          >
            Remove
          </Button>
        </>
      }
    />
  );
}
