using Source.Data;

namespace Source
{
    public static class HardcodeFixes
    {
        public static void Fix(Repository repository)
        {
            Console.WriteLine("Applying hardcode fixes...");
            var canner = repository.recipeTypes.First(x => x.name == "Canner");
            canner.fluidInputs = canner.fluidOutputs = new RecipeDimensions(1, 1);
            
            var eoh = repository.recipeTypes.First(x => x.name == "Eye of Harmony");
            eoh.fluidInputs = new RecipeDimensions(1, 3);
        }
    }
}