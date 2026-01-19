/**
 * Store for managing selected item and drawer state
 */

class SelectedItemStore {
	selectedItemId = $state<string | null>(null);
	drawerOpen = $state(false);

	/**
	 * Select an item and open the drawer
	 */
	selectItem(itemId: string) {
		this.selectedItemId = itemId;
		this.drawerOpen = true;
	}

	/**
	 * Close the drawer
	 */
	closeDrawer() {
		this.drawerOpen = false;
	}
}

export const selectedItem = new SelectedItemStore();
