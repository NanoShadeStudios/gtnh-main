using Source;

namespace GT_recipe_parser
{
    public class AspectModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("DESCRIPTION")]
        public string Description { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("PRIMAL")]
        public bool Primal { get; set; }

        [SchemaName("ICON_ID")]
        public string IconId { get; set; }
    }

    public class AspectAspectModel
    {
        [SchemaName("COMPONENT_OF_ID")]
        public string ComponentOfId { get; set; }

        [SchemaName("COMPONENTS_ID")]
        public string ComponentsId { get; set; }
    }

    public class AspectEntryModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("AMOUNT")]
        public int Amount { get; set; }

        [SchemaName("ASPECT_ID")]
        public string AspectId { get; set; }

        [SchemaName("ITEM_ID")]
        public string ItemId { get; set; }
    }
}