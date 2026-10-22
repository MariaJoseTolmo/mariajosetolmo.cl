export interface IdGenerator {
  uuid(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');
