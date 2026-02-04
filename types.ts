export type SheetRow = (string | number | boolean | null)[];
export type SheetData = SheetRow[];

export type HighlightColor = 'green' | 'red';

export interface HighlightedCells {
  [key: string]: HighlightColor;
}

export type CellNotes = {
    [key: string]: string;
};

export type FilterType = 'all' | 'green' | 'red' | 'none';