export namespace Methods {
  export namespace RefreshCache {
    export const METHOD = 'tombi/refreshCache';
    export type Response = boolean;
  }

  export namespace ListSchemas {
    export interface SchemaInfo {
      title?: string;
      description?: string;
      uri: string;
      fileMatch?: string[];
      catalogUri?: string;
      tomlVersion?: string;
    }
    export interface Response {
      schemas: SchemaInfo[];
    }
    export const METHOD = 'tombi/listSchemas';
  }

  export namespace AssociateSchema {
    export interface Params {
      title?: string;
      description?: string;
      uri: string;
      fileMatch: string[];
      tomlVersion?: string;
      force?: boolean;
    }
    export const METHOD = 'tombi/associateSchema';
  }

  export namespace UpdateConfig {
    export const METHOD = 'tombi/updateConfig';
    export type Response = boolean;
  }

  export namespace UpdateSchema {
    export const METHOD = 'tombi/updateSchema';
    export type Response = boolean;
  }

  export namespace GetStatus {
    export interface Response {
      tomlVersion: string;
      source: string;
      configPath?: string;
      ignore?: boolean;
      schema?: string;
    }
    export const METHOD = 'tombi/getStatus';
  }
}
