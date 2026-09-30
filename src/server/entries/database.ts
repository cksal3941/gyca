export interface SqlConnection {
  query(sql: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

export interface EntryDatabase extends SqlConnection {
  transaction<T>(run: (connection: SqlConnection) => Promise<T>): Promise<T>;
}
