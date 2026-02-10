import { Repository, Goods, Item, Fluid, OreDict, RecipeObject } from "./repository.js";
import { NeiSelect, ShowNei, ShowNeiContext, ShowNeiMode } from "./nei.js";
import { ShowTooltip, HideTooltip, IsHovered } from "./tooltip.js";

// Global cycling state
let globalIndex = 0;
let oredictElements: IconBox[] = [];

// Global actions map
export const actions: { [key: string]: string } = {
    "item_icon_click": "Left/Right click to add recipe",
    "select": "Click to select",
    "toggle_link_ignore": "Click to toggle link ignore",
    "crafter_click": "Click to select another crafter"
};

// Start global cycle once
window.setInterval(() => {
    globalIndex++;
    for (const element of oredictElements) {
        element.UpdateIconId();
    }
}, 500);

let highlightStyle: HTMLStyleElement = document.getElementById('item-icon-highlight-style') as HTMLStyleElement;

export class IconBox extends HTMLElement
{
    public obj:RecipeObject | null = null;
    public dataId: string | null = null;
    public iconInitialized: boolean = false;

    constructor()
    {
        super();
        // Absolutely minimal constructor - no work at all
    }

    connectedCallback()
    {
        // Store data-id and initialize immediately since rows are now size-limited
        this.dataId = this.getAttribute('data-id');
        
        // Initialize icon immediately
        this.InitializeIcon();
        
        // Attach event handlers
        this.addEventListener('mouseenter', () => this.HandleMouseEnter());
        this.addEventListener('mouseleave', () => this.HandleMouseLeave());
        this.addEventListener('click', () => this.HandleLeftClick());
        this.addEventListener('contextmenu', (e: MouseEvent) => this.HandleRightClick(e));
    }
    
    public InitializeIcon()
    {
        if (this.iconInitialized || !this.dataId) return;
        this.iconInitialized = true;
        
        try {
            const obj = Repository.current.GetById<RecipeObject>(this.dataId);
            if (obj) {
                const goods = obj instanceof OreDict ? obj.items[0] : obj;
                if (goods && 'iconId' in goods) {
                    const iconId = (goods as any).iconId;
                    const ix = iconId % 256;
                    const iy = Math.floor(iconId / 256);
                    this.style.setProperty('--pos-x', `${ix * -32}px`);
                    this.style.setProperty('--pos-y', `${iy * -32}px`);
                }
            }
        } catch (error) {
            console.error("Error initializing icon:", error);
        }
    }

    private StartOredictCycle(oredict: OreDict) {
        if (!oredict || oredict.items.length === 0) return;
        
        this.UpdateIconId();
        
        // Add to global cycle if not already there
        if (!oredictElements.includes(this)) {
            oredictElements.push(this);
        }
    }

    private StopOredictCycle() {
        const index = oredictElements.indexOf(this);
        if (index > -1) {
            oredictElements.splice(index, 1);
        }
    }

    private UpdateHighlightStyle() {
        const currentIconId = this.obj?.id;
        if (currentIconId && !this.classList.contains('item-icon-grid')) {
            highlightStyle.textContent = `
                item-icon[data-id="${currentIconId}"] {
                    box-shadow: 0 0 0 2px #4CAF50;
                    background-color: #4CAF5020;
                }
            `;
        }
    }

    private EnsureObjectLoaded() {
        if (!this.obj && this.dataId) {
            this.obj = Repository.current.GetById<RecipeObject>(this.dataId);
            if (this.obj instanceof OreDict) {
                this.StartOredictCycle(this.obj);
            } else {
                this.UpdateIconId();
            }
        }
    }

    UpdateIconId() {
        const obj = this.GetDisplayObject();
        if (obj) {
            const iconId = obj.iconId;
            const ix = iconId % 256;
            const iy = Math.floor(iconId / 256);
            this.style.setProperty('--pos-x', `${ix * -32}px`);
            this.style.setProperty('--pos-y', `${iy * -32}px`);
            
            // Update tooltip if this element is currently being hovered
            if (IsHovered(this)) {
                ShowTooltip(this, { goods: obj });
                this.UpdateHighlightStyle();
            }
        }
    }

    static get observedAttributes() {
        return ['data-id'];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'data-id' && oldValue !== newValue) {
            this.StopOredictCycle();
            this.obj = null;
            this.dataId = newValue;
            this.iconInitialized = false;
        }
    }

    GetDisplayObject():Goods | null
    {
        if (this.obj instanceof Goods) {
            return this.obj;
        }

        if (this.obj instanceof OreDict) {
            return this.obj.items[globalIndex % this.obj.items.length];
        }

        return null;
    }

    disconnectedCallback()
    {
        this.StopOredictCycle();
        HideTooltip(this);
        if (IsHovered(this)) {
            highlightStyle.textContent = '';
        }
    }

    private CustomAction():string | null
    {
        return this.getAttribute('data-action');
    }

    HandleRightClick(event:MouseEvent)
    {
        this.InitializeIcon();
        this.EnsureObjectLoaded();
        if (this.CustomAction())
            return;
        if (event.ctrlKey || event.metaKey)
            return;
        event.preventDefault();
        ShowNei(this.obj, ShowNeiMode.Consumption, null);
    }

    HandleLeftClick()
    {
        this.InitializeIcon();
        this.EnsureObjectLoaded();
        let action = this.CustomAction();
        if (action === "select")
            NeiSelect(this.GetDisplayObject() as Goods);
        if (action)
            return;
        ShowNei(this.obj, ShowNeiMode.Production, null);
    }

    HandleMouseEnter()
    {
        this.InitializeIcon();
        this.EnsureObjectLoaded();
        const obj = this.GetDisplayObject();
        if (obj) {
            const actionType = this.getAttribute('data-action');
            const actionText = actionType ? actions[actionType] : undefined;
            ShowTooltip(this, {
                goods: obj,
                action: actionText ?? "Left/Right click to view Production/Consumption for this item"
            });
            
            this.UpdateHighlightStyle();
        }
    }

    HandleMouseLeave()
    {
        highlightStyle.textContent = '';
    }
}

customElements.define("item-icon", IconBox);