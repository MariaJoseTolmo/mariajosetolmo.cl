/** The single public profile shown to recruiters. */
export interface Profile {
  readonly name: string;
  readonly role: string;
  readonly architecture: string;
  readonly domains: readonly string[];
  readonly openToWork: boolean;
}
