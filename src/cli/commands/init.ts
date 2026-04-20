export interface InitOptions {
  cwd?: string;
  sendOnly?: boolean;
  receiveOnly?: boolean;
  force?: boolean;
  swAddon?: boolean;
  skipSw?: boolean;
}

export interface InitResult {
  generated: string[];
  skipped: string[];
  serwistDetected: boolean;
  swConflict: boolean;
}

export async function runInit(_opts: InitOptions = {}): Promise<InitResult> {
  throw new Error("runInit: not implemented yet (Task 19)");
}
