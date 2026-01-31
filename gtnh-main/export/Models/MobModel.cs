using Source;

namespace GT_recipe_parser
{
    public class MobModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("ARMOUR")]
        public int Armour { get; set; }

        [SchemaName("HEALTH")]
        public double Health { get; set; }

        [SchemaName("HEIGHT")]
        public double Height { get; set; }

        [SchemaName("IMAGE_FILE_PATH")]
        public string ImageFilePath { get; set; }

        [SchemaName("IMMUNE_TO_FIRE")]
        public bool ImmuneToFire { get; set; }

        [SchemaName("INTERNAL_NAME")]
        public string InternalName { get; set; }

        [SchemaName("LEASHABLE")]
        public bool Leashable { get; set; }

        [SchemaName("LOCALIZED_NAME")]
        public string LocalizedName { get; set; }

        [SchemaName("MOD_ID")]
        public string ModId { get; set; }

        [SchemaName("NBT")]
        public string Nbt { get; set; }

        [SchemaName("WIDTH")]
        public double Width { get; set; }
    }

    public class MobInfoModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("ALLOWED_IN_PEACEFUL")]
        public bool AllowedInPeaceful { get; set; }

        [SchemaName("ALLOWED_INFERNAL")]
        public bool AllowedInfernal { get; set; }

        [SchemaName("ALWAYS_INFERNAL")]
        public bool AlwaysInfernal { get; set; }

        [SchemaName("SOUL_VIAL_USABLE")]
        public bool SoulVialUsable { get; set; }

        [SchemaName("MOB_ID")]
        public string MobId { get; set; }
    }

    public class MobInfoDropsModel
    {
        [SchemaName("MOB_INFO_ID")]
        public string MobInfoId { get; set; }

        [SchemaName("DROPS_ITEM_ID")]
        public string DropsItemId { get; set; }

        [SchemaName("DROPS_LOOTABLE")]
        public bool DropsLootable { get; set; }

        [SchemaName("DROPS_PLAYER_ONLY")]
        public bool DropsPlayerOnly { get; set; }

        [SchemaName("DROPS_PROBABILITY")]
        public double DropsProbability { get; set; }

        [SchemaName("DROPS_STACK_SIZE")]
        public int DropsStackSize { get; set; }

        [SchemaName("DROPS_TYPE")]
        public string DropsType { get; set; }
    }

    public class MobInfoSpawnInfoModel
    {
        [SchemaName("MOB_INFO_ID")]
        public string MobInfoId { get; set; }

        [SchemaName("SPAWN_INFO")]
        public string SpawnInfo { get; set; }
    }
}