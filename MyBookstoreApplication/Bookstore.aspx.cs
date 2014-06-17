using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Data;

namespace MyBookstoreApplication
{
    public partial class _Bookstore : System.Web.UI.Page
    {
        PDFTronApiClient pdftronClient = new PDFTronApiClient();

        protected void Page_Load(object sender, EventArgs e)
        {
            int page = getPageInQueryString();
            int pageSize = 12;
            int pageIndex = page * pageSize;

            DataSet ds = pdftronClient.listDocuments(pageIndex, pageSize);
            booksList.DataSource = ds;
            booksList.DataBind();
        }

        protected void UpdateTimer_Tick(object sender, EventArgs e)
        {
            bool dirtyFlag = false;
            DataSet ds = (booksList.DataSource as DataSet);
            foreach (DataRow dr in ds.Tables["document"].Select("convertedDate Is Null"))
            {
                String documentId = (String)dr["documentId"];
                DataSet newDocument = pdftronClient.getDocumentInfo(documentId);
                Object oldConvertedDate = dr["convertedDate"];
                Object newConvertedDate = newDocument.Tables["document"].Rows[0]["convertedDate"];

                if (!oldConvertedDate.Equals(newConvertedDate))
                {
                    dr["convertedDate"] = newConvertedDate;
                    dirtyFlag = true;
                }

            }

            if (dirtyFlag)
            {
                booksList.DataSource = ds;
                booksList.DataBind();
            }
        }

        protected void NextLinkButton_Click(Object sender, EventArgs e)
        {
            int page = getPageInQueryString();
            Response.Redirect("Bookstore.aspx?page=" + (page + 1));
        }

        protected void PrevLinkButton_Click(Object sender, EventArgs e)
        {
            int page = getPageInQueryString();
            Response.Redirect("Bookstore.aspx?page=" + Math.Max(page - 1, 0));
        }

        protected int getPageInQueryString()
        {
            int page = 0;
            int.TryParse(Request.QueryString["page"], out page);
            return page;
        }
    }
}
