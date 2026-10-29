// Browsers send a blank field as "", which zod would read as 0 under z.coerce.number().
export const emptyAsMissing = (value: unknown) => (value === "" ? undefined : value);

// One ticked box comes as a string, several as an array, none as nothing.
export const checkboxArray = (value: unknown) => (value === undefined ? [] : [value].flat());
