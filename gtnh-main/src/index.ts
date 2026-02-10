const loading = document.getElementById("loading")!;
try {
    console.log("Starting load...");
    // Load the atlas image
    const atlas = new Image();
    atlas.src = "data/atlas.webp";

    console.log("Loading repository and data...");
    // Load repository and data in parallel
    const [repositoryModule, response] = await Promise.all([
        import("./repository.js"),
        fetch("data/data.bin")
    ]);
    console.log("Decompressing data...");
    const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    console.log("Loading repository...");
    repositoryModule.Repository.load(buffer);

    console.log("Loading modules...");
    // Then load other modules
    await Promise.all([
        import("./itemIcon.js"),
        import("./tooltip.js"),
        import("./nei.js"),
        import("./menu.js"),
        import("./recipeList.js"),
        import("./modeManager.js")
    ]);
    console.log("Initializing mode manager...");
    let modeManager = await import("./modeManager.js");
    modeManager.InitializeModeManager();
    console.log("Updating project...");
    let page = await import("./page.js");
    page.UpdateProject();
    console.log("Load complete!");
    loading.remove();
} catch (error:any) {
    console.error("Load error:", error);
    loading.innerHTML = "An error occurred on loading:<br>" + error.message;
    console.error(error);
}

export {};