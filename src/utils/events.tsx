export type Modifiers = {
  shift: boolean;
  alt: boolean;
  control: boolean;
  meta: boolean;
};

export const extractModifiers = (event: any): Modifiers => {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    control: event.ctrlKey,
    meta: event.metaKey,
  };
};
