type Screen = 'welcome' | 'api-key' | 'sources';
const SCREENS: Screen[] = ['welcome', 'api-key', 'sources'];

export class Onboarding {
  currentScreen: Screen = 'welcome';
  private apiKey = '';
  private sources: string[] = [];
  private completed = false;

  next() {
    const idx = SCREENS.indexOf(this.currentScreen);
    if (idx < SCREENS.length - 1) this.currentScreen = SCREENS[idx + 1];
  }

  back() {
    const idx = SCREENS.indexOf(this.currentScreen);
    if (idx > 0) this.currentScreen = SCREENS[idx - 1];
  }

  goTo(screen: Screen) {
    this.currentScreen = screen;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getApiKey() {
    return this.apiKey;
  }

  toggleSource(source: string) {
    const idx = this.sources.indexOf(source);
    if (idx === -1) this.sources.push(source);
    else this.sources.splice(idx, 1);
  }

  getSelectedSources() {
    return this.sources;
  }

  canSkip() {
    return true;
  }

  skip() {
    this.completed = true;
  }

  finish() {
    this.completed = true;
  }

  isComplete() {
    return this.completed;
  }
}
