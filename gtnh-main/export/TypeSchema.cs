using System;
using System.Buffers;
using System.Collections.Generic;
using System.Diagnostics.Contracts;
using System.Globalization;
using System.Reflection;
using System.Text.RegularExpressions;

namespace Source
{
    public abstract class TypeSchema
    {
        public abstract Func<object> GetConstructor();
        public abstract ReadOnlySpanAction<char, object> GetSetter(string key);
        public readonly string tableName;
        protected TypeSchema(string tableName)
        {
            this.tableName = tableName;
        }
    }

    [AttributeUsage(validOn:AttributeTargets.Property)]
    public class SchemaNameAttribute : Attribute
    {
        public readonly string name;
        public SchemaNameAttribute(string name) => this.name = name;
    }
    
    public class TypeSchema<T> : TypeSchema
    {
        public override Func<object> GetConstructor() => () => Activator.CreateInstance<T>();

        public override ReadOnlySpanAction<char, object> GetSetter(string key) => setters.GetValueOrDefault(key);
        public T[] ToTypedArray(List<object> list)
        {
            var arr = new T[list.Count];
            for (var j = 0; j < arr.Length; j++)
                arr[j] = (T)list[j];
            return arr;
        }

        private readonly Dictionary<string, ReadOnlySpanAction<char, object>> setters = new();


        private Regex escapedRegex;
        private string ReplaceEscapeSequences(string escaped)
        {
            if (!escaped.Contains("\\u"))
                return escaped;
            if (escapedRegex == null)
                escapedRegex = new Regex(@"\\u....", RegexOptions.Compiled);
            return escapedRegex.Replace(escaped, match =>
            {
                var unicodeValue = int.Parse(match.Groups[0].Value.AsSpan().Slice(2), NumberStyles.HexNumber);
                return ((char)unicodeValue).ToString();
            });
        }
        
        public TypeSchema(string tableName) : base(tableName)
        {
            
            foreach (var property in typeof(T).GetProperties())
            {
                var nameAttribute = property.GetCustomAttribute<SchemaNameAttribute>();
                var name = nameAttribute != null ? nameAttribute.name : property.Name;
                var setter = property.SetMethod;
                if (property.PropertyType == typeof(string))
                {
                    var del = (Action<T, string>)setter.CreateDelegate(typeof(Action<T, string>));
                    setters[name] = (s, obj) => del((T)obj, ReplaceEscapeSequences(s.ToString()));
                } 
                else if (property.PropertyType == typeof(int))
                {
                    var del = (Action<T, int>)setter.CreateDelegate(typeof(Action<T, int>));
                    setters[name] = (s, obj) => del((T)obj, int.TryParse(s, out var res) ? res : throw new FormatException("Invalid integer: "+s.ToString()));
                }
                else if (property.PropertyType == typeof(bool))
                {
                    var del = (Action<T, bool>)setter.CreateDelegate(typeof(Action<T, bool>));
                    setters[name] = (s, obj) => del((T)obj, s.SequenceEqual("TRUE"));
                }
                else if (property.PropertyType == typeof(double))
                {
                    var del = (Action<T, double>)setter.CreateDelegate(typeof(Action<T, double>));
                    setters[name] = (s, obj) => del((T)obj, double.TryParse(s, out var res) ? res : throw new FormatException("Invalid double: "+s.ToString()));
                }
                else if (property.PropertyType == typeof(long))
                {
                    var del = (Action<T, long>)setter.CreateDelegate(typeof(Action<T, long>));
                    setters[name] = (s, obj) => del((T)obj, long.TryParse(s, out var res) ? res : throw new FormatException("Invalid long: "+s.ToString()));
                }
                else throw new NotSupportedException("Parsing of type " + property.PropertyType + " is not supported (in type "+typeof(T)+")");
            }
        }
    }
}