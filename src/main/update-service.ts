import { app, BrowserWindow, dialog } from 'electron';
import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

const UPDATE_CHECK_DELAY_MS = 3000;

class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private isChecking = false;
  private manualCheckPending = false;

  constructor() {
    autoUpdater.logger = log;
    log.transports.file.level = 'info';

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    const channel = process.env.UPDATE_CHANNEL;
    if (channel) {
      autoUpdater.channel = channel;
      autoUpdater.allowPrerelease = channel !== 'stable';
    }

    this.registerListeners();
  }

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  scheduleUpdateCheck(delayMs = UPDATE_CHECK_DELAY_MS): void {
    if (!this.isEnabled()) return;
    setTimeout(() => void this.checkForUpdates(false), delayMs);
  }

  async checkForUpdates(userInitiated = false): Promise<void> {
    if (!this.isEnabled()) {
      if (userInitiated) {
        await this.showInfoDialog('Updates unavailable', 'Updates are only available in packaged builds.');
      }
      return;
    }

    if (this.isChecking) return;
    this.isChecking = true;
    this.manualCheckPending = this.manualCheckPending || userInitiated;

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Update check failed:', error);
      if (this.manualCheckPending) {
        await this.showErrorDialog('Update check failed', 'Unable to check for updates right now.');
        this.manualCheckPending = false;
      }
    } finally {
      this.isChecking = false;
    }
  }

  private isEnabled(): boolean {
    return app.isPackaged && process.env.AUTO_UPDATES !== 'false';
  }

  private registerListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });

    autoUpdater.on('update-available', info => {
      log.info('Update available:', info.version);
      this.manualCheckPending = false;
      void this.showUpdatePrompt(info.version);
    });

    autoUpdater.on('update-not-available', () => {
      log.info('Update not available');
      if (this.manualCheckPending) {
        this.manualCheckPending = false;
        void this.showInfoDialog('Up to date', 'You already have the latest version.');
      }
    });

    autoUpdater.on('download-progress', progress => {
      log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    });

    autoUpdater.on('update-downloaded', info => {
      log.info('Update downloaded:', info.version);
      this.manualCheckPending = false;
      void this.showInstallPrompt(info.version);
    });

    autoUpdater.on('error', error => {
      log.error('Update error:', error);
      if (this.manualCheckPending) {
        this.manualCheckPending = false;
        void this.showErrorDialog('Update error', 'Something went wrong while updating.');
      }
    });
  }

  private async showUpdatePrompt(version: string): Promise<void> {
    const result = await this.showQuestionDialog(
      'Update available',
      `Version ${version} is available. Download now?`,
      ['Later', 'Download']
    );
    if (result === 1) {
      autoUpdater.downloadUpdate();
    }
  }

  private async showInstallPrompt(version: string): Promise<void> {
    const result = await this.showQuestionDialog(
      'Update ready',
      `Version ${version} has been downloaded. Restart to install?`,
      ['Later', 'Restart']
    );
    if (result === 1) {
      autoUpdater.quitAndInstall(false, true);
    }
  }

  private async showInfoDialog(title: string, message: string): Promise<void> {
    await this.showMessageBox({
      type: 'info',
      title,
      message
    });
  }

  private async showErrorDialog(title: string, message: string): Promise<void> {
    await this.showMessageBox({
      type: 'error',
      title,
      message
    });
  }

  private async showQuestionDialog(
    title: string,
    message: string,
    buttons: string[]
  ): Promise<number> {
    const { response } = await this.showMessageBox({
      type: 'info',
      title,
      message,
      buttons,
      defaultId: 1,
      cancelId: 0
    });
    return response;
  }

  private async showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    const parent = this.getDialogParent();
    if (parent) return dialog.showMessageBox(parent, options);
    return dialog.showMessageBox(options);
  }

  private getDialogParent(): BrowserWindow | undefined {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return undefined;
    return this.mainWindow;
  }
}

export const updateService = new UpdateService();
