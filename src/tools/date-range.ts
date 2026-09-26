const DAY = 86_400_000;

export function checkedDateRange(from: string, to: string): {start: string; end: string} {
	const datePattern = /^\d{4}-\d{2}-\d{2}$/;
	if (!datePattern.test(from) || !datePattern.test(to)) {
		throw new Error('Dates must use YYYY-MM-DD.');
	}

	const start = Date.parse(`${from}T00:00:00.000Z`);
	const end = Date.parse(`${to}T00:00:00.000Z`);
	if (!Number.isFinite(start) || !Number.isFinite(end)
		|| new Date(start).toISOString().slice(0, 10) !== from
		|| new Date(end).toISOString().slice(0, 10) !== to || end < start || end - start >= 32 * DAY) {
		throw new Error('Choose a valid inclusive date range of at most 32 days.');
	}

	return {start: new Date(start).toISOString(), end: new Date(end + DAY - 1).toISOString()};
}
