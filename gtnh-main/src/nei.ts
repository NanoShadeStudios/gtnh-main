import { GetScrollbarWidth, voltageTier, formatAmount, CoilTierNames, TIER_MV, getFusionTierByStartupCost } from "./utils.js";
import { Goods, Fluid, Item, Repository, IMemMappedObjectPrototype, Recipe, RecipeType, RecipeIoType, RecipeInOut, RecipeObject, OreDict, GtRecipeMetadata } from "./repository.js";
import { SearchQuery } from "./searchQuery.js";
import { ShowTooltip, HideTooltip } from "./tooltip.js";

const repository = Repository.current;
const nei = document.getElementById("nei")!;
const neiScrollBox = nei.querySelector("#nei-scroll") as HTMLElement;
const neiContent = nei.querySelector("#nei-content") as HTMLElement;
const searchBox = nei.querySelector("#nei-search") as HTMLInputElement;
const neiTabs = nei.querySelector("#nei-tabs") as HTMLElement;
const neiBack = nei.querySelector("#nei-back") as HTMLButtonElement;
const neiClose = nei.querySelector("#nei-close") as HTMLButtonElement;
const elementSize = 36;

let currentGoods: RecipeObject | null = null;

document.addEventListener("keydown", (event) => {
    if (nei.classList.contains("hidden"))
        return;
    // Handle Escape key
    if (event.key === "Escape") {
        if (searchBox.value == "") {
            HideNei();
        } else {
            searchBox.value = "";
            SearchChanged();
        }
        return;
    }

    if (event.key === "Backspace" && document.activeElement !== searchBox) {
        Back();
        return;
    }

    // Only handle printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && searchBox.value == "") {
        if (document.activeElement !== searchBox) {
            searchBox.focus();
        }
    }
});

searchBox.addEventListener("input", SearchChanged);
neiScrollBox.addEventListener("scroll", UpdateVisibleItems);
neiBack.addEventListener("click", Back);
neiClose.addEventListener("click", HideNei);

let unitWidth = 0, unitHeight = 0;
let scrollWidth = GetScrollbarWidth();
window.addEventListener("resize", Resize);

type NeiFiller = (grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap) => void;

class ItemAllocator implements NeiRowAllocator<Goods>
{
    CalculateWidth(): number { return 1; }
    CalculateHeight(obj: Goods): number { return 1; }
    BuildRowDom(elements:Goods[], elementWidth:number, elementHeight:number, rowY:number):string
    {
        var dom:string[] = [];
        const isSelectingGoods = showNeiCallback?.onSelectGoods != null;
        const selectGoodsAction = isSelectingGoods ? ' data-action="select"' : "";
        const gridWidth = elements.length * 36;
        dom.push(`<div class="nei-items-row icon-grid" style="--grid-pixel-width:${gridWidth}px; --grid-pixel-height:36px; top:${elementSize*rowY}px">`);
        for (var i=0; i<elements.length; i++) {
            var elem = elements[i];
            const gridX = (i % elements.length) * 36 + 2;
            const gridY = Math.floor(i / elements.length) * 36 + 2;
            dom.push(`<item-icon class="item-icon-grid" style="--grid-x:${gridX}px; --grid-y:${gridY}px" data-id="${elem.id}"${selectGoodsAction}></item-icon>`);
        }
        dom.push(`</div>`);
        return dom.join("");
    }
}

class NeiRecipeTypeInfo extends Array implements NeiRowAllocator<Recipe>
{
    type:RecipeType;
    dimensions:Int32Array;
    allocator:RecipeTypeAllocator;
    constructor(type:RecipeType)
    {
        super();
        this.type = type;
        this.dimensions = type.dimensions;
        this.allocator = new RecipeTypeAllocator();
    }

    CalculateWidth():number
    {
        var dims = this.dimensions;
        return Math.max(dims[0], dims[2]) + Math.max(dims[4], dims[6]) + 3;
    }

    CalculateHeight(recipe:Recipe):number
    {
        var dims = this.dimensions;
        var h = Math.max(dims[1] + dims[3], dims[5] + dims[7], 2) + 1;
        var gtRecipe = recipe.gtRecipe;
        if (gtRecipe != null)
        {
            h++;
            h += Math.ceil(gtRecipe.metadata.length / 2);
        }
        return h;
    }

    BuildRecipeItemGrid(dom:string[], items:RecipeInOut[], index:number, type:RecipeIoType, dimensionOffset:number):number
    {
        const startTime = performance.now();
        const maxTime = 100; // Maximum 100ms per grid
        
        var dimX = this.dimensions[dimensionOffset];
        if (dimX == 0)
            return index;
        var dimY = this.dimensions[dimensionOffset + 1];
        var count = dimX * dimY;
        const gridWidth = dimX * 36;
        const gridHeight = dimY * 36;
        dom.push(`<div class="icon-grid" style="--grid-pixel-width:${gridWidth}px; --grid-pixel-height:${gridHeight}px">`);
        
        let startIndex = index;
        let itemsAdded = 0;
        
        while (index < items.length) {
            // Absolute timeout check
            if (performance.now() - startTime > maxTime) {
                console.error("BuildRecipeItemGrid timeout after", performance.now() - startTime, "ms at index", index);
                break;
            }
            
            var item = items[index];
            
            // Move past this type completely
            if (item.type > type)
                break;
            
            // Move to next item
            index++;
            
            // Skip items that don't fit in this grid
            if (item.slot >= count)
                continue;
            
            // This item fits, render it
            // Lazily create a minimal goods object if not already created
            // We avoid calling GetObject for OreDict because its constructor loads all items
            var goods = item.goods;
            if (!goods) {
                if (item.type === RecipeIoType.OreDictInput) {
                    // Create minimal OreDict-like object without calling constructor
                    const objectOffset = item.goodsPtr;
                    const elements = repository.elements;
                    const idPtr = elements[objectOffset / 4 + 3]; // id is at offset 3
                    const id = repository.GetString(idPtr);
                    goods = item.goods = { id, objectOffset, repository } as any;
                } else {
                    // For Item and Fluid, GetObject is safe
                    let proto = (item.type === RecipeIoType.ItemInput || item.type === RecipeIoType.ItemOutput) ? Item : Fluid;
                    goods = item.goods = repository.GetObject(item.goodsPtr, proto);
                }
            }
            
            const gridX = (item.slot % dimX) * 36 + 2;
            const gridY = Math.floor(item.slot / dimX) * 36 + 2;
            var iconAttrs = `class="item-icon-grid" style="--grid-x:${gridX}px; --grid-y:${gridY}px" data-id="${goods.id}"`;
            var amountText = formatAmount(item.amount);
            
            var isFluid = goods instanceof Fluid;
            var isGoods = goods instanceof Goods;
            if (isFluid || item.amount != 1)
                iconAttrs += ` data-amount="${amountText}"`;
            dom.push(`<item-icon ${iconAttrs}>`);
            if (item.probability < 1 && (type == RecipeIoType.ItemOutput || type == RecipeIoType.FluidOutput))
                dom.push(`<span class="probability">${Math.round(item.probability*100)}%</span>`);
            dom.push(`</item-icon>`);
            itemsAdded++;
        }
        
        dom.push(`</div>`);
        return index;
    }

    BuildRecipeIoDom(dom:string[], items:RecipeInOut[], index:number, item:RecipeIoType, fluid:RecipeIoType, dimensionOffset:number):number
    {
        dom.push(`<div class = "nei-recipe-items">`);
        index = this.BuildRecipeItemGrid(dom, items, index, item, dimensionOffset);
        index = this.BuildRecipeItemGrid(dom, items, index, fluid, dimensionOffset+2);
        dom.push(`</div>`);
        return index;
    }

    FormatCircuitConflicts(circuitConflicts: number): string {
        if (circuitConflicts === 0) {
            return "No recipe conflicts";
        }

        const conflictingCircuits: number[] = [];
        let n = circuitConflicts;
        while (n !== 0) {
            // Get position of rightmost set bit
            const pos = Math.log2(n & -n);
            conflictingCircuits.push(pos);
            // Remove rightmost set bit
            n = n & (n - 1);
        }

        if (conflictingCircuits.length === 1) {
            return `Recipe conflicts on circuit #${conflictingCircuits[0]}`;
        }
        return `Recipe conflicts on circuits #${conflictingCircuits.join(", #")}`;
    }

    BuildRowDom(elements:Recipe[], elementWidth:number, elementHeight:number, rowY:number, overrideIo?:RecipeInOut[]):string
    {
        console.log("      BuildRowDom START: elements =", elements.length);
        let dom:string[] = [];
        const canSelectRecipe = showNeiCallback?.onSelectRecipe != null;
        
        for (let i=0; i<elements.length; i++) {
            console.log("      Recipe", i, "of", elements.length, "id:", elements[i].id);
            
            try {
                let recipe = elements[i];
                let recipeItems;
                
                if (overrideIo) {
                    recipeItems = overrideIo;
                } else {
                    // Manually parse recipe items with timeout protection instead of using recipe.items
                    console.log("      Manually parsing recipe data...");
                    const slice = (recipe as any).GetSlice(5);
                    const itemCount = slice.length / 5;
                    
                    if (itemCount > 500 || itemCount <= 0) {
                        console.error("Invalid item count:", itemCount);
                        continue;
                    }
                    
                    recipeItems = [];
                    let sliceIndex = 0;
                    const startTime = performance.now();
                    
                    for (let j = 0; j < itemCount; j++) {
                        // More frequent timeout check - every item for the first few
                        if ((j < 5 || j % 5 === 0) && performance.now() - startTime > 100) {
                            console.error("Timeout while parsing recipe items at item", j);
                            break;
                        }
                        
                        const type = slice[sliceIndex++];
                        const ptr = slice[sliceIndex++];
                        const slot = slice[sliceIndex++];
                        const amount = slice[sliceIndex++];
                        const probability = slice[sliceIndex++];
                        
                        console.log(`      Parsing item ${j}: type=${type} ptr=${ptr}`);
                        
                        // CRITICAL: Don't call GetObject here - it triggers OreDict.GetArray which loops
                        // We'll create the goods object lazily when rendering
                        recipeItems.push({
                            type: type,
                            goodsPtr: ptr,
                            goods: null as any, // Will be populated lazily
                            slot: slot,
                            amount: amount,
                            probability: probability / 100
                        });
                    }
                    
                    console.log("      Successfully parsed", recipeItems.length, "items");
                }
                
                if (!recipeItems || recipeItems.length === 0) {
                    console.warn("Recipe has no items, skipping");
                    continue;
                }
            
                dom.push(`<div class="nei-recipe-box" style="left:${Math.round(i * elementWidth * elementSize)}px; top:${rowY*elementSize}px; width:${Math.round(elementWidth*elementSize)}px; height:${elementHeight*elementSize}px">`);
                dom.push(`<div class="nei-recipe-io">`);
                console.log("      Calling BuildRecipeIoDom for inputs...");
                let index = this.BuildRecipeIoDom(dom, recipeItems, 0, RecipeIoType.OreDictInput, RecipeIoType.FluidInput, 0);
                console.log("      Input done, index =", index);
                dom.push(`<div class="arrow-container">`);
                dom.push(`<div class="arrow"></div>`);
                if (canSelectRecipe) {
                    dom.push(`<button class="select-recipe-btn" data-recipe="${recipe.objectOffset}">+</button>`);
                }
                dom.push(`</div>`);
                console.log("      Calling BuildRecipeIoDom for outputs...");
                this.BuildRecipeIoDom(dom, recipeItems, index, RecipeIoType.ItemOutput, RecipeIoType.FluidOutput, 4);
                console.log("      Output done");
                dom.push(`</div>`);
                console.log("      Checking gtRecipe...");
                if (recipe.gtRecipe != null) {
                    console.log("      Has gtRecipe, adding metadata...");
                    dom.push(`<span>${voltageTier[recipe.gtRecipe.voltageTier].name} • ${recipe.gtRecipe.durationSeconds}s`);
                    if (recipe.gtRecipe.amperage != 1)
                        dom.push(` • ${recipe.gtRecipe.amperage}A`);
                    dom.push(`</span><span class="text-small">${formatAmount(recipe.gtRecipe.voltage)}v • ${formatAmount(recipe.gtRecipe.voltage * recipe.gtRecipe.amperage * recipe.gtRecipe.durationTicks)}eu</span>`);
                    for (const metadata of recipe.gtRecipe.metadata) {
                        let str = MetadataToString(metadata, recipe);
                        if (str != null) {
                            dom.push(`<span class="text-small">${str}</span>`);
                        }
                    }
                    dom.push(`<span class="text-small">${this.FormatCircuitConflicts(recipe.gtRecipe.circuitConflicts)}</span>`);
                }
                console.log("      Recipe", i, "complete");
                dom.push(`</div>`);
            } catch (error) {
                console.error("Error rendering recipe", i, ":", error);
                dom.push(`<div style="padding: 10px; color: red;">Error rendering recipe</div>`);
            }
        }
        console.log("      BuildRowDom END, returning");
        return dom.join("");
    }
}

const FuelTypeNames = ["Diesel", "Gas", "Hot", "Dense Steam", "Plasma", "Magic"];

function DisplayHeatRequired(heat:number, recipe:Recipe):string {
    let rawTier = Math.min(13, Math.max(0, (heat - 1800) / 900));
    let tier = Math.ceil(rawTier);
    if (tier > 0 && recipe.recipeType.name === "Blast Furnace") {
        let ebfTierSkip = TIER_MV + Math.ceil((rawTier - tier + 1) * 9);
        if (ebfTierSkip <= recipe.gtRecipe.voltageTier + 2) {
            if (recipe.gtRecipe.voltageTier >= ebfTierSkip)
                return "Heat: "+heat+"K (Volc "+CoilTierNames[tier]+" / EBF "+CoilTierNames[tier-1]+")";
            return "Heat: "+heat+"K (Volc "+CoilTierNames[tier]+" / "+voltageTier[ebfTierSkip]?.name+" EBF "+CoilTierNames[tier-1]+")";
        }
    }
    return "Heat: "+heat+"K ("+CoilTierNames[tier]+")";
}

function DisplayFusionTier(euToStart:number):string {
    let tier = getFusionTierByStartupCost(euToStart);
    return "To start: "+formatAmount(euToStart)+" EU (T"+tier+")";
}

function DisplayNkeRange(nke:number):string {
    let min = nke % 10000;
    let max = Math.floor(nke / 10000);
    return "Kinetic energy: "+min+" - "+max+" MeV";
}

function MetadataToString(metadata:GtRecipeMetadata, recipe:Recipe):string | null {
    switch (metadata.key) {
        case "low_gravity": return metadata.value == 1 ? "Requires low gravity" : null;
        case "cleanroom": return metadata.value == 1 ? "Requires cleanroom" : null;
        case "fuel_type": return `Fuel type: ${FuelTypeNames[metadata.value]}`;
        case "fuel_value": return `Fuel value: ${formatAmount(metadata.value)} EU/L`;
        case "fusion_threshold": return DisplayFusionTier(metadata.value);
        case "fog_plasma_multistep": return metadata.value == 1 ? "Multi-step plasma" : "Single-step plasma";
        case "fog_plasma_tier": return `Plasma tier: ${metadata.value}`;
        case "pcb_factory_tier": case "nano_forge_tier": return `Requires tier ${metadata.value}`;
        case "GLASS": return "Glass tier: " + voltageTier[metadata.value-1].name;
        case "qft_focus_tier": return "QFT focus tier: " + metadata.value;
        case "recycle": return metadata.value == 1 ? "Recycle recipe" : null;
        case "coil_heat": return DisplayHeatRequired(metadata.value, recipe);
        case "nke_range": return DisplayNkeRange(metadata.value);
        default: return `${metadata.key}: ${formatAmount(metadata.value)}`;
    }
}

class RecipeTypeAllocator implements NeiRowAllocator<RecipeType>
{
    CalculateWidth(): number { return -1; }
    CalculateHeight(obj: RecipeType): number { return 1; }
    
    BuildRowDom(elements:RecipeType[], elementWidth:number, elementHeight:number, rowY:number):string
    {
        let single = elements[0];
        let dom:string[] = [];
        dom.push(`<div class="nei-recipe-type" style="top:${rowY*elementSize}px; width:${elementWidth*elementSize}px">`);
        for (let block of single.singleblocks) {
            if (block)
                dom.push(`<item-icon data-id="${block.id}"></item-icon>`);
        }
        for (let block of single.multiblocks) {
            dom.push(`<item-icon data-id="${block.id}"></item-icon>`);
        }
        dom.push(`<span class="nei-recipe-type-name">${single.name}</span>`);
        dom.push(`</div>`);
        return dom.join("");
    }
}

let itemAllocator = new ItemAllocator();
var FillNeiAllItems:NeiFiller = function(grid:NeiGrid, search : SearchQuery | null)
{
    var allocator = grid.BeginAllocation(itemAllocator);
    FillNeiItemsWith(allocator, search, Repository.current.fluids, Fluid);
    FillNeiItemsWith(allocator, search, Repository.current.items, Item);
}

function FillNeiItemsWith<T extends Goods>(grid:NeiGridAllocator<Goods>, search: SearchQuery | null, arr:Int32Array, proto:IMemMappedObjectPrototype<T>):void
{
    var len = arr.length;
    for (var i=0; i<len; i++) {
        var element = repository.GetObjectIfMatchingSearch(search, arr[i], proto);
        if (element !== null)
            grid.Add(element);
    }
}

var FillNeiAllRecipes:NeiFiller = function(grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap)
{
    for (const recipeType of allRecipeTypes) {
        var list = recipes[recipeType.name];
        if (list.length > 0) {
            {
                let allocator = grid.BeginAllocation(list.allocator);
                allocator.Add(recipeType);
            }

            {
                let allocator = grid.BeginAllocation(list)
                for (let i=0; i<list.length; i++) {
                    if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                        allocator.Add(list[i]);
                }
            }
        }
    }
}

function FillNeiSpecificRecipes(recipeType:RecipeType) : NeiFiller
{
    return function(grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap)
    {
        var list = recipes[recipeType.name];
        let allocator = grid.BeginAllocation(list)
        for (let i=0; i<list.length; i++)
            if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                allocator.Add(list[i]);
    }
}

function SearchChanged()
{
    search = searchBox.value === "" ? null : new SearchQuery(searchBox.value);
    if (search !== null && (search.words.length === 0 && search.mod === null))
        search = null;
    RefreshNeiContents();
}

type NeiRecipeMap = {[type:string]: NeiRecipeTypeInfo};
const mapRecipeTypeToRecipeList:NeiRecipeMap = {};
let allRecipeTypes:RecipeType[];
let filler:NeiFiller = FillNeiAllItems;
let search:SearchQuery | null = null;

type NeiHistory = {
    goods:RecipeObject | null;
    mode:ShowNeiMode;
    tabIndex:number;
}

let neiHistory:NeiHistory[] = [];

{
    let allRecipeTypePointers = repository.recipeTypes;
    allRecipeTypes = new Array(allRecipeTypePointers.length);
    for (var i=0; i<allRecipeTypePointers.length; i++)
    {
        var recipeType = repository.GetObject(allRecipeTypePointers[i], RecipeType);
        mapRecipeTypeToRecipeList[recipeType.name] = new NeiRecipeTypeInfo(recipeType);
        allRecipeTypes[i] = recipeType;
    }
}

export enum ShowNeiMode
{
    Production, Consumption
}

let currentMode:ShowNeiMode = ShowNeiMode.Production;

export enum ShowNeiContext
{
    None, Click, SelectRecipe, SelectGoods
}   

export type ShowNeiCallback = {
    onSelectGoods?(goods:Goods):void;
    onSelectRecipe?(recipe:Recipe):void;
}

let showNeiCallback:ShowNeiCallback | null = null;

export function HideNei()
{
    nei.classList.add("hidden");
    showNeiCallback = null;
    currentGoods = null;
    neiInitialized = false;
}

export function NeiSelect(goods:Goods)
{
    console.log("ShowNei select (Goods): ", goods);
    if (showNeiCallback != null && showNeiCallback.onSelectGoods) {
        showNeiCallback.onSelectGoods(goods);
    }
    HideNei();
}

function AddToSet(set:Set<Recipe>, goods:Goods, mode:ShowNeiMode)
{
    let list = mode == ShowNeiMode.Production ? goods.production : goods.consumption;
    for (var i=0; i<list.length; i++)
        set.add(repository.GetObject(list[i], Recipe));
}

function GetAllOreDictRecipes(set:Set<Recipe>, goods:OreDict, mode:ShowNeiMode):void
{
    for (var i=0; i<goods.items.length; i++) {
        AddToSet(set, goods.items[i], mode);
    }
}

function GetAllFluidRecipes(set:Set<Recipe>, goods:Fluid, mode:ShowNeiMode):void
{
    AddToSet(set, goods, mode);
    let containers = goods.containers;
    for (var i=0; i<containers.length; i++) {
        var container = repository.GetObject(repository.items[containers[i]], Item);
        AddToSet(set, container, mode);
    }
}

function Back()
{
    const last = neiHistory.pop();
    if (last)
        ShowNeiInternal(last.goods, last.mode, last.tabIndex);
}

export function ShowNei(goods:RecipeObject | null, mode:ShowNeiMode, callback:ShowNeiCallback | null = null)
{
    console.log("ShowNei", goods, mode, callback);
    
    if (callback != null) {
        showNeiCallback = callback;
        neiHistory.length = 0;
    } else {
        if (!nei.classList.contains("hidden"))
            neiHistory.push({goods:currentGoods, mode:currentMode, tabIndex:activeTabIndex});
    }
    nei.classList.remove("hidden");
    
    // Ensure dimensions are initialized
    if (unitWidth === 0 || unitHeight === 0) {
        Resize();
    }
    
    ShowNeiInternal(goods, mode);
}

function ShowNeiInternal(goods:RecipeObject | null, mode:ShowNeiMode, tabIndex:number = -1)
{
    currentGoods = goods;
    currentMode = mode;
    
    // Show NEI immediately with a loading state
    neiBack.style.display = neiHistory.length > 0 ? "" : "none";
    
    // Process recipes and update UI
    let recipes:Set<Recipe> = new Set();
    if (goods instanceof OreDict) {
        GetAllOreDictRecipes(recipes, goods, mode);
    } else if (goods instanceof Fluid) {
        GetAllFluidRecipes(recipes, goods, mode);
    } else if (goods instanceof Item && goods.container) {
        GetAllFluidRecipes(recipes, goods.container.fluid, mode);
    } else if (goods instanceof Goods) {
        AddToSet(recipes, goods, mode);
    }
    
    // Clear all recipe lists first
    for (const recipeType of allRecipeTypes) {
        mapRecipeTypeToRecipeList[recipeType.name].length = 0;
    }
    
    // Fill recipe lists
    for (var recipe of recipes) {
        var recipeType = recipe.recipeType;
        var list = mapRecipeTypeToRecipeList[recipeType.name];
        list.push(recipe);
    }
    
    search = null;
    searchBox.value = "";

    // Update tab visibility BEFORE selecting tab
    updateTabVisibility();

    // Determine which tab to show
    let newTabIndex = tabIndex;
    if (tabIndex === -1) {
        if (goods === null) {
            newTabIndex = 0; // Show "All Items"
        } else {
            // When viewing recipes for an item, use "All Recipes" tab (tab 1)
            // This shows all recipe types for the item in one view
            newTabIndex = 1;
        }
    }
    
    console.log("Selecting tab", newTabIndex, "for goods", goods?.id, "mode", mode);
    neiInitialized = true;
    switchTab(newTabIndex);
}

type NeiGridContents = Recipe | Goods | RecipeType;

interface NeiRowAllocator<T extends NeiGridContents>
{
    CalculateWidth():number;
    CalculateHeight(obj:T):number;
    BuildRowDom(elements:T[], elementWidth:number, elementHeight:number, rowY:number):string;
}

class NeiGridRow
{
    y:number = 0;
    height:number = 1;
    elementWidth:number = 1;
    elements:NeiGridContents[] = [];
    allocator:NeiRowAllocator<any> | null = null;

    Clear(y:number, allocator:NeiRowAllocator<any> | null, elementWidth:number)
    {
        this.allocator = allocator;
        this.y = y;
        this.height = 1;
        this.elementWidth = elementWidth;
        this.elements.length = 0;
    }

    Add(element:NeiGridContents, height:number)
    {
        this.elements.push(element);
        if (height > this.height)
            this.height = height;
    }
}

interface NeiGridAllocator<T extends NeiGridContents>
{
    Add(element:T):void;
}

class NeiGrid implements NeiGridAllocator<any>
{
    rows:NeiGridRow[] = [];
    rowCount:number = 0;
    width:number = 1;
    height:number = 0;
    allocator:NeiRowAllocator<NeiGridContents> | null = null;
    currentRow:NeiGridRow | null = null;
    elementWidth:number = 1;
    elementsPerRow:number = 1;

    Clear(width:number)
    {
        this.rowCount = 0;
        this.width = width;
        this.height = 0;
        this.currentRow = null;
        this.allocator = null;
        this.elementWidth = 1;
        this.elementsPerRow = 1;
    }

    BeginAllocation<T extends NeiGridContents>(allocator: NeiRowAllocator<T>):NeiGridAllocator<T>
    {
        this.FinishRow();
        this.allocator = allocator;
        this.elementWidth = allocator.CalculateWidth();
        if (this.elementWidth == -1)
            this.elementWidth = this.width;
        this.elementsPerRow = Math.max(1, Math.trunc(this.width/this.elementWidth));
        //this.elementWidth = this.width / this.elementsPerRow;
        return this;
    }

    FinishRow()
    {
        if (this.currentRow === null)
            return;
        this.height = this.currentRow.y + this.currentRow.height;
        this.currentRow = null;
    }

    private NextRow():NeiGridRow
    {
        this.FinishRow();
        var row = this.rows[this.rowCount];
        if (row === undefined)
            this.rows[this.rowCount] = row = new NeiGridRow();
        row.Clear(this.height, this.allocator, this.elementWidth);
        this.currentRow = row;
        this.rowCount++;
        return row;
    }

    Add<T extends NeiGridContents>(element:T)
    {
        var row = this.currentRow;
        if (row === null || row.elements.length >= this.elementsPerRow)
            row = this.NextRow();
        var height = this.allocator?.CalculateHeight(element) ?? 1;
        if (row.height < height)
            row.height = height;
        row.elements.push(element);
    }
}

function Resize()
{
    var newUnitWidth = Math.round((window.innerWidth - 30 - scrollWidth) / elementSize);
    var newUnitHeight = Math.round((window.innerHeight - 120) / elementSize);
    var widthRemainder = window.innerWidth - newUnitWidth;
    if (newUnitWidth !== unitWidth || newUnitHeight !== unitHeight)
    {
        unitWidth = newUnitWidth;
        unitHeight = newUnitHeight;
        var windowWidth = unitWidth * elementSize + scrollWidth;
        var windowHeight = unitHeight * elementSize;
        if ((window.innerWidth - windowWidth) % 2 == 1)
            windowWidth++;
        if ((window.innerWidth - windowHeight) % 2 == 1)
            windowHeight++;
        neiScrollBox.style.width = `${windowWidth}px`;
        neiScrollBox.style.height = `${windowHeight}px`;
        
        // Only refresh if size actually changed
        RefreshNeiContents();
    }
}

let grid = new NeiGrid();
let maxVisibleRow = 0;
let renderingInProgress = false;
let renderTimeout: number | null = null;
let neiInitialized = false;

function RefreshNeiContents()
{
    // Debounce rapid calls
    if (renderTimeout !== null) {
        clearTimeout(renderTimeout);
    }
    
    renderTimeout = window.setTimeout(() => {
        renderTimeout = null;
        DoRefreshNeiContents();
    }, 50);
}

function DoRefreshNeiContents()
{
    // Don't refresh until NEI is properly initialized
    if (!neiInitialized) {
        console.log("Skipping refresh - NEI not initialized yet");
        return;
    }
    
    // Clear any pending debounced calls
    if (renderTimeout !== null) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
    }
    
    // If already rendering, cancel the current render and start fresh
    if (renderingInProgress) {
        console.log("Canceling previous render to start new one");
    }
    
    renderingInProgress = true;
    
    try {
        console.log("DoRefreshNeiContents: filler =", filler.name, "currentGoods =", currentGoods?.id);
        grid.Clear(unitWidth);
        filler(grid, search, mapRecipeTypeToRecipeList);
        grid.FinishRow();
        neiContent.style.minHeight = `${grid.height*elementSize}px`;
        maxVisibleRow = 0;
        neiContent.innerHTML = "";
        
        console.log("Grid ready:", grid.rowCount, "rows");
        
        // Immediately update visible items
        UpdateVisibleItems();
        renderingInProgress = false;
        
    } catch (error) {
        console.error("Error in RefreshNeiContents:", error);
        neiContent.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Error loading recipes</div>';
        renderingInProgress = false;
    }
}

function UpdateVisibleItems()
{
    var top = Math.floor(neiScrollBox.scrollTop/elementSize);
    var bottom = top + unitHeight + 2; // Add buffer
    
    console.log("UpdateVisibleItems: processing rows", maxVisibleRow, "to", grid.rowCount);
    
    // Render all visible items at once
    for (var i=maxVisibleRow; i<grid.rowCount; i++) {
        console.log("  Processing row", i);
        var row = grid.rows[i];
        if (row.y >= bottom) {
            console.log("  Row", i, "out of view, stopping");
            return;
        }
        FillDomWithGridRow(row);
        console.log("  Row", i, "rendered successfully");
        maxVisibleRow = i+1;
    }
    console.log("UpdateVisibleItems: completed, rendered", maxVisibleRow, "rows");
}

function FillDomWithGridRow(row: NeiGridRow)
{
    console.log("    FillDomWithGridRow: allocator =", row.allocator?.constructor.name, "elements =", row.elements.length);
    var allocator = row.allocator;
    if (allocator == null) {
        console.log("    Allocator is null, skipping");
        return;
    }
    try {
        console.log("    Calling BuildRowDom...");
        var dom = allocator.BuildRowDom(row.elements, row.elementWidth, row.height, row.y);
        console.log("    BuildRowDom completed, dom length:", dom.length);
        neiContent.insertAdjacentHTML("beforeend", dom);
        console.log("    Inserted into DOM");
    } catch (error) {
        console.error("Error in BuildRowDom:", error, row);
    }
}

// Tab management
interface NeiTab {
    name: string;
    filler: NeiFiller;
    iconId: number;
    isVisible(): boolean;
}

const tabs: NeiTab[] = [
    { 
        name: "All Items", 
        filler: FillNeiAllItems, 
        iconId: repository.GetObject(repository.service[0], Item).iconId,
        isVisible: () => true // Always visible
    },
    { 
        name: "All Recipes", 
        filler: FillNeiAllRecipes, 
        iconId: repository.GetObject(repository.service[1], Item).iconId,
        isVisible: () => currentGoods !== null // Visible only when viewing recipes
    }
];

// Add tabs for each recipe type
allRecipeTypes.forEach(recipeType => {
    tabs.push({
        name: recipeType.name,
        filler: FillNeiSpecificRecipes(recipeType),
        iconId: recipeType.defaultCrafter.iconId,
        isVisible: () => mapRecipeTypeToRecipeList[recipeType.name].length > 0
    });
});

let activeTabIndex = 0;

function createTabs() {
    neiTabs.innerHTML = '';
    tabs.forEach((tab, index) => {
        const tabElement = document.createElement('div');
        tabElement.className = 'panel-tab';
        const iconId = tab.iconId;
        const ix = iconId % 256;
        const iy = Math.floor(iconId / 256);
        tabElement.innerHTML = `<icon class="icon" style="--pos-x:${ix * -32}px; --pos-y:${iy * -32}px"></icon>`;
        tabElement.addEventListener('click', () => switchTab(index));
        tabElement.addEventListener('mouseenter', () => ShowTooltip(tabElement, { header: tab.name }));
        neiTabs.appendChild(tabElement);
    });
    // Set initial active tab
    neiTabs.children[0]?.classList.add('active');
}

function updateTabVisibility() {
    tabs.forEach((tab, index) => {
        const tabElement = neiTabs.children[index] as HTMLElement;
        if (tabElement) {
            tabElement.style.display = tab.isVisible() ? '' : 'none';
        }
    });
}

function switchTab(index: number) {
    // Validate index
    if (index < 0 || index >= tabs.length) {
        console.error("Invalid tab index:", index, "max:", tabs.length - 1);
        index = 0;
    }
    
    // Update active state
    neiTabs.children[activeTabIndex]?.classList.remove('active');
    neiTabs.children[index]?.classList.add('active');
    activeTabIndex = index;
    
    // Update filler and refresh content
    filler = tabs[index].filler;
    
    // Only refresh if filler changed or forced
    RefreshNeiContents();
}

export function GetSingleRecipeDom(recipe:Recipe, overrideIo?:RecipeInOut[])
{
    let recipeType = recipe.recipeType;
    let builder = mapRecipeTypeToRecipeList[recipeType.name];
    let width = builder.CalculateWidth();
    let height = builder.CalculateHeight(recipe);
    let dom = builder.BuildRowDom([recipe], width, height, 0, overrideIo);
    return dom;
}

// Initialize tabs
createTabs();

// Add global click handler for recipe selection
neiContent.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const selectButton = target.closest(".select-recipe-btn");
    if (selectButton && showNeiCallback?.onSelectRecipe) {
        console.log("Select button clicked");
        const recipeOffset = parseInt(selectButton.getAttribute("data-recipe") || "0");
        console.log("Getting recipe object for offset:", recipeOffset);
        const recipe = repository.GetObject(recipeOffset, Recipe);
        console.log("Got recipe object:", recipe.id);
        console.log("Calling onSelectRecipe callback...");
        showNeiCallback.onSelectRecipe(recipe);
        console.log("Callback completed, hiding NEI");
        HideNei();
    }
});
