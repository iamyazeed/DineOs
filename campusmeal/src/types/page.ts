export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export interface PageProps {
  searchParams: SearchParams;
}
