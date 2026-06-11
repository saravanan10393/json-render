/**
 * Custom UI components — one self-contained file per component. This barrel
 * aggregates them into the two maps the parent catalog + components modules
 * consume (`uiComponentDefinitions` and `uiComponents`). The layout/typography
 * `primitives` (./primitives.tsx) are folded in here too.
 *
 * PORTED from json-render-llm (see ../../../CATALOG_MIGRATION.md). The form
 * layer (Form/Field/FormAction), routing outlets (PageOutlet/ModalOutlet), and
 * the components that collide with rapp's data-bound adapters
 * (DataTable/Chart/Stat/DescriptionList/Stepper/DatePicker, Sonner/Toaster) are
 * intentionally NOT imported here — rapp keeps its own versions, and the Form
 * engine returns in Phase 2.
 *
 * To add a component: create `<Name>.tsx` exporting `definition` (zod catalog
 * entry) + `component` (json-render registry component), then add it to both
 * maps below.
 */
import { primitiveComponentDefinitions, primitiveComponents } from "./primitives"
import * as AlertDialog from "./AlertDialog"
import * as AspectRatio from "./AspectRatio"
import * as AvatarGroup from "./AvatarGroup"
import * as Breadcrumb from "./Breadcrumb"
import * as Calendar from "./Calendar"
import * as Chart from "./Chart"
import * as Combobox from "./Combobox"
import * as Command from "./Command"
import * as ContextMenu from "./ContextMenu"
import * as Counter from "./Counter"
import * as Empty from "./Empty"
import * as FileUrls from "./FileUrls"
import * as HoverCard from "./HoverCard"
import * as InputGroup from "./InputGroup"
import * as InputMask from "./InputMask"
import * as InputOTP from "./InputOTP"
import * as Item from "./Item"
import * as Kbd from "./Kbd"
import * as Label from "./Label"
import * as Menubar from "./Menubar"
import * as MultiSelect from "./MultiSelect"
import * as NavigationMenu from "./NavigationMenu"
import * as Progress from "./Progress"
import * as Rating from "./Rating"
import * as Resizable from "./Resizable"
import * as ScrollArea from "./ScrollArea"
import * as Sheet from "./Sheet"
import * as Sidebar from "./Sidebar"
import * as Timeline from "./Timeline"

/** Catalog definitions — spread into `defineCatalog`. */
export const uiComponentDefinitions = {
	...primitiveComponentDefinitions,
	AlertDialog: AlertDialog.definition,
	AspectRatio: AspectRatio.definition,
	AvatarGroup: AvatarGroup.definition,
	Breadcrumb: Breadcrumb.definition,
	Calendar: Calendar.definition,
	Chart: Chart.definition,
	Combobox: Combobox.definition,
	Command: Command.definition,
	ContextMenu: ContextMenu.definition,
	Counter: Counter.definition,
	Empty: Empty.definition,
	FileUrls: FileUrls.definition,
	HoverCard: HoverCard.definition,
	InputGroup: InputGroup.definition,
	InputMask: InputMask.definition,
	InputOTP: InputOTP.definition,
	Item: Item.definition,
	Kbd: Kbd.definition,
	Label: Label.definition,
	Menubar: Menubar.definition,
	MultiSelect: MultiSelect.definition,
	NavigationMenu: NavigationMenu.definition,
	Progress: Progress.definition,
	Rating: Rating.definition,
	Resizable: Resizable.definition,
	ScrollArea: ScrollArea.definition,
	Sheet: Sheet.definition,
	Sidebar: Sidebar.definition,
	Timeline: Timeline.definition
}

/** Registry components — spread into `defineRegistry`. */
export const uiComponents = {
	...primitiveComponents,
	AlertDialog: AlertDialog.component,
	AspectRatio: AspectRatio.component,
	AvatarGroup: AvatarGroup.component,
	Breadcrumb: Breadcrumb.component,
	Calendar: Calendar.component,
	Chart: Chart.component,
	Combobox: Combobox.component,
	Command: Command.component,
	ContextMenu: ContextMenu.component,
	Counter: Counter.component,
	Empty: Empty.component,
	FileUrls: FileUrls.component,
	HoverCard: HoverCard.component,
	InputGroup: InputGroup.component,
	InputMask: InputMask.component,
	InputOTP: InputOTP.component,
	Item: Item.component,
	Kbd: Kbd.component,
	Label: Label.component,
	Menubar: Menubar.component,
	MultiSelect: MultiSelect.component,
	NavigationMenu: NavigationMenu.component,
	Progress: Progress.component,
	Rating: Rating.component,
	Resizable: Resizable.component,
	ScrollArea: ScrollArea.component,
	Sheet: Sheet.component,
	Sidebar: Sidebar.component,
	Timeline: Timeline.component
}
