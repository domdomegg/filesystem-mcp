import * as os from 'node:os';

export function expandPath(p: string): string {
	if (p.startsWith('~/')) {
		return p.replace('~', os.homedir());
	}

	if (p === '~') {
		return os.homedir();
	}

	return p;
}
