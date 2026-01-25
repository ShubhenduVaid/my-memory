export class ObsidianPlugin {
  getVaultPath(): string | undefined {
    return undefined;
  }

  getCommands(): { id: string; name: string }[] {
    return [{ id: 'my-memory-search', name: 'Search My Memory' }];
  }
}

export function generateObsidianUri(vault: string, file: string): string {
  return `obsidian://open?vault=${vault}&file=${encodeURIComponent(file)}`;
}
