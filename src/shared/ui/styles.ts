/**
 * Shared sizing for interactive controls.
 *
 * 44×44 px minimum everywhere a finger might be used. Only on md+ screens with a fine pointer
 * (mouse/trackpad) do controls shrink to the denser 36 px desktop size.
 */
export const controlHeight = 'min-h-11 md:pointer-fine:min-h-9';
export const controlSquare = 'size-11 md:pointer-fine:size-9';

export const controlBase =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium select-none ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50';
