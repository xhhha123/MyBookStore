using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Net;
using System.Data;
using System.Xml;
using System.IO;
using System.Xml.Linq;
using System.Text;
using System.Web.Configuration;

namespace MyBookstoreApplication
{
    using pdftron;
    using pdftron.FDF;
    using pdftron.PDF;
    using pdftron.SDF;

    public partial class _Upload : System.Web.UI.Page
    {

        //public string localViewUrl = "mywebviewer.aspx";
        public string localViewUrl = "http://local.mybookstore.com/mywebviewer.aspx";
        public string viewLink = string.Empty;
        protected void Page_Load(object sender, EventArgs e)
        {
            // You can change the maximum file size allowed in Web.config
            // e.g.<httpRuntime executionTimeout="240" maxRequestLength="20480" />
            // You may also need to change the timeout value of WebClient.
            // See PDFTronWebClient for modifying timeout value.

            System.Configuration.Configuration config = WebConfigurationManager.OpenWebConfiguration("~");
            HttpRuntimeSection section = config.GetSection("system.web/httpRuntime") as HttpRuntimeSection;
            double maxFileSize = Math.Round(section.MaxRequestLength / 1024.0, 1);
            FileSizeLimit.Text = string.Format("Make sure your file is under {0:0.#} MB.", maxFileSize);
        }


        protected void UploadButton_Click(object sender, EventArgs e)
        {
            if (this.FileUploadControl.HasFile)
            {
                //Save the form uploaded file
                String filePath = Server.MapPath("~/App_Data/" + FileUploadControl.FileName);
                this.FileUploadControl.SaveAs(filePath);

                //upload the file to PDFTron API
                PDFTronApiClient pdftronClient = new PDFTronApiClient();
               string documentId= pdftronClient.uploadDocumentAndShare(filePath);
                //Response.Redirect("~/UploadCompleted.aspx");
               this.txtDeleteId.Text = documentId;
               this.txtDownloadId.Text = documentId;
               this.txtStatusId.Text = documentId;
               this.txtSessionId.Text = documentId;

            }
        }

        protected void DownloadDocument_Click(object sender, EventArgs e)
        {
            PDFTronApiClient pdftronClient=new PDFTronApiClient ();

            string fileType = this.ddtDownloadType.SelectedItem.Text;
            string fileName = pdftronClient.download(this.txtDownloadId.Text, fileType, false);

            this.link.Text = (fileName == "-1") ? "Not Found" : fileName;
            this.link.Visible = true;

        }

        protected void DocumentStatus_Click(object sender, EventArgs e)
        {
            PDFTronApiClient pdftronClient = new PDFTronApiClient();
            DataSet document = pdftronClient.getDocumentInfo(this.txtStatusId.Text);
            string status = document.Tables["document"].Rows[0]["operationStatus"].ToString();
            string name = document.Tables["document"].Rows[0]["name"].ToString();
            this.lbMessage.Text = String.Format("Status: {0} Viewable: {1}", status, name);
        }

        protected void DeleteDocument_Click(object sender, EventArgs e)
        {
            PDFTronApiClient pdftronClient = new PDFTronApiClient();
            DataSet document = pdftronClient.getDocumentInfo(this.txtStatusId.Text);
            string status = pdftronClient.deleteDocument(this.txtDeleteId.Text);
            this.lbMessage.Text = string.Format("Status: {0}", status);

        }

        protected void linkBtn_Click(object sender, EventArgs e)
        {
           
        }

        protected void CreateSession_Click(object sender, EventArgs e)
        {
            PDFTronApiClient pdftronClient = new PDFTronApiClient();
            string sessionId = pdftronClient.createSession(this.txtSessionId.Text, int.Parse(this.txtMin.Text.ToString()));

             viewLink = string.Format("{0}?id={1}&cloudApiId={2}&u={3}&showToolbarControl={4}&enableOfflineMode={5}&enableReadOnlyMode={6}&admin={7}&annotate={8}",
                 localViewUrl, 
                 txtSessionId.Text,
                 sessionId,
                 txtUser.Text+"|"+txtUserId.Text,
                 (chkShowtoolbar.Checked)?"true":"false",
                 (chkOfficeMode.Checked)?"true":"false",
                 (chkReadOnly.Checked)?"true":"false",
                 (chkAdmin.Checked)?"true":"false",
                 (chkAnnotation.Checked)?"true":"false"
                    );

           // this.linkBtn.Text = "creatsession succeed ,click the view button";
             this.link.Text = viewLink;
             this.link.NavigateUrl = viewLink;
             this.link.Visible = true;

        }

        protected void View_Click(object sender, EventArgs e)
        {

            HttpContext.Current.Response.Write("<script language='javascript'>window.open('" + viewLink + "');</script>");
        }

        protected void DownloadWithAnnotation_Click(object sender, EventArgs e)
        {
            //1.we need to download the xod from PDFTron
            //2.we have to find out the xfdf accroding to user
            //3.creat fdf with xfdf
            //4.merge pdf with fdf,xod
            //5.send the file to user
            PDFTronApiClient pdftronClient = new PDFTronApiClient();
            string url = pdftronClient.download(this.txtDocumentId.Text, "xod", false);

            string annotationPath = HttpContext.Current.Server.MapPath("~/annotations/");

            WebClient web = new WebClient();
            byte[] bt = web.DownloadData(url);

            string xfdfPath = FindXFDFPath();

            string xodPath = annotationPath + txtAnnotationUser.Text + ".pdf.xod";

            using (FileStream fsxod = File.Create(xodPath))
            {
                fsxod.Write(bt, 0, bt.Length);
                fsxod.Close();
            }

            PDFDoc doc = new PDFDoc();

            if (!string.IsNullOrEmpty(xfdfPath))
            {
                string pdfWithAnnotation=annotationPath + txtAnnotationUser.Text+".pdf";

                FDFDoc fdf = new FDFDoc(FDFDoc.CreateFromXFDF(xfdfPath));

                pdftron.PDF.Convert.ToPdf(doc, xodPath);

                doc.FDFMerge(fdf);

                doc.Save(pdfWithAnnotation, SDFDoc.SaveOptions.e_linearized);

                doc.Close();
                using (FileStream fspdf = new FileStream(pdfWithAnnotation, FileMode.Open))
                {

                    byte[] bytes = new byte[(int)fspdf.Length];
                    fspdf.Read(bytes, 0, bytes.Length);
                    HttpContext.Current.Response.ContentType = "application/octet-stream";
                    HttpContext.Current.Response.AddHeader("Content-Disposition", "attachment;   filename=" + HttpUtility.UrlEncode(txtAnnotationUser.Text + ".pdf", System.Text.Encoding.UTF8));
                    HttpContext.Current.Response.BinaryWrite(bytes);
                    HttpContext.Current.Response.Flush();
                    HttpContext.Current.Response.End();

                }
                //File.Delete(xodPath);
                //File.Delete(pdfWithAnnotation);
            }

           
            
        }

        public void GeneratorPDFWithXFDF()
        { 
        }

        public string FindXFDFPath()
        {
            string xfdfPath = string.Empty;

            string annotationPath = HttpContext.Current.Server.MapPath("~/annotations/");

            xfdfPath = Path.Combine(annotationPath, txtDocumentId.Text, txtAnnotationUser.Text + ".xfdf");
            if (!File.Exists(xfdfPath))
            {
                xfdfPath = string.Empty;
            }
            return xfdfPath;
        }

    }
}
