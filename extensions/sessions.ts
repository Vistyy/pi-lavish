const reviewUrls = new Map<string, string>();

export function getReviewUrl(file: string): string | undefined {
	return reviewUrls.get(file);
}

export function rememberReviewUrl(file: string, url: string): void {
	reviewUrls.set(file, url);
}

export function forgetReviewUrl(file: string): void {
	reviewUrls.delete(file);
}
