using Source;

namespace GT_recipe_parser
{
    public class OreDictionaryModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("NAME")]
        public string Name { get; set; }

        [SchemaName("ITEM_GROUP_ID")]
        public string ItemGroupId { get; set; }
    }
}