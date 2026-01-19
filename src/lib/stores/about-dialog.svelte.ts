/**
 * Store for managing about dialog state
 */

class AboutDialogStore {
	open = $state(false);

	/**
	 * Open the about dialog
	 */
	openDialog() {
		this.open = true;
	}

	/**
	 * Close the about dialog
	 */
	closeDialog() {
		this.open = false;
	}
}

export const aboutDialog = new AboutDialogStore();
