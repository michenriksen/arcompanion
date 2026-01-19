/**
 * Store for managing search dialog state
 */

class SearchDialogStore {
	open = $state(false);

	/**
	 * Open the search dialog
	 */
	openDialog() {
		this.open = true;
	}

	/**
	 * Close the search dialog
	 */
	closeDialog() {
		this.open = false;
	}
}

export const searchDialog = new SearchDialogStore();
